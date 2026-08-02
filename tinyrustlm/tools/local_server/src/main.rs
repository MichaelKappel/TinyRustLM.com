#![forbid(unsafe_code)]
#![doc = "No-crate local static server for TinyRustLM browser development."]

use std::env;
use std::fs::File;
use std::io::{self, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Component, Path, PathBuf};
use std::process::ExitCode;
use std::time::Duration;

const DEFAULT_ROOT: &str = "tinyrustlm";
const DEFAULT_PORT: u16 = 8080;
const READ_LIMIT: usize = 8192;

fn main() -> ExitCode {
    match run() {
        Ok(()) => ExitCode::SUCCESS,
        Err(ServerError::PortInUse(port)) => {
            eprintln!("Port {port} is already in use on 127.0.0.1.");
            ExitCode::from(2)
        }
        Err(error) => {
            eprintln!("TinyRustLM Rust static server failed: {error}");
            ExitCode::from(1)
        }
    }
}

fn run() -> Result<(), ServerError> {
    let config = Config::from_env(env::args().skip(1))?;
    let root = config.root.canonicalize().map_err(|source| {
        ServerError::InvalidRoot(format!("{} ({source})", config.root.display()))
    })?;
    let listener = TcpListener::bind(("127.0.0.1", config.port)).map_err(|source| {
        if source.kind() == io::ErrorKind::AddrInUse {
            ServerError::PortInUse(config.port)
        } else {
            ServerError::Io(source)
        }
    })?;

    println!(
        "TinyRustLM Rust static server listening at http://127.0.0.1:{}/app/",
        config.port
    );

    for stream in listener.incoming() {
        match stream {
            Ok(mut stream) => {
                if let Err(error) = handle_stream(&root, &mut stream) {
                    let _ = write_response(
                        &mut stream,
                        500,
                        "internal server error",
                        "text/plain; charset=utf-8",
                        false,
                    );
                    eprintln!("TinyRustLM request failed: {error}");
                }
            }
            Err(error) => eprintln!("TinyRustLM connection failed: {error}"),
        }
    }

    Ok(())
}

#[derive(Debug)]
struct Config {
    root: PathBuf,
    port: u16,
}

impl Config {
    fn from_env<I>(mut args: I) -> Result<Self, ServerError>
    where
        I: Iterator<Item = String>,
    {
        let root = args
            .next()
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from(DEFAULT_ROOT));
        let port = match args.next() {
            Some(value) => value
                .parse::<u16>()
                .map_err(|_| ServerError::InvalidPort(value))?,
            None => DEFAULT_PORT,
        };
        if let Some(extra) = args.next() {
            return Err(ServerError::UnexpectedArgument(extra));
        }
        Ok(Self { root, port })
    }
}

#[derive(Debug)]
enum ServerError {
    BadRequest(String),
    Forbidden,
    InvalidPort(String),
    InvalidRoot(String),
    Io(io::Error),
    PortInUse(u16),
    UnexpectedArgument(String),
}

impl std::fmt::Display for ServerError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ServerError::BadRequest(message) => write!(formatter, "bad request: {message}"),
            ServerError::Forbidden => write!(formatter, "forbidden path"),
            ServerError::InvalidPort(port) => write!(formatter, "invalid port '{port}'"),
            ServerError::InvalidRoot(root) => write!(formatter, "invalid root '{root}'"),
            ServerError::Io(source) => write!(formatter, "{source}"),
            ServerError::PortInUse(port) => write!(formatter, "port {port} is in use"),
            ServerError::UnexpectedArgument(value) => {
                write!(formatter, "unexpected extra argument '{value}'")
            }
        }
    }
}

impl From<io::Error> for ServerError {
    fn from(source: io::Error) -> Self {
        ServerError::Io(source)
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum Method {
    Get,
    Head,
}

fn handle_stream(root: &Path, stream: &mut TcpStream) -> Result<(), ServerError> {
    stream.set_read_timeout(Some(Duration::from_secs(5)))?;
    stream.set_write_timeout(Some(Duration::from_secs(5)))?;

    let request = read_request(stream)?;
    let Some(line) = request.lines().next() else {
        write_response(
            stream,
            400,
            "bad request",
            "text/plain; charset=utf-8",
            false,
        )?;
        return Ok(());
    };

    let parsed = match parse_request_line(line) {
        Ok(parsed) => parsed,
        Err(_) => {
            write_response(
                stream,
                400,
                "bad request",
                "text/plain; charset=utf-8",
                false,
            )?;
            return Ok(());
        }
    };

    let method = match parsed.method {
        "GET" => Method::Get,
        "HEAD" => Method::Head,
        _ => {
            write_response(
                stream,
                405,
                "method not allowed",
                "text/plain; charset=utf-8",
                false,
            )?;
            return Ok(());
        }
    };

    match resolve_path(root, parsed.target) {
        Ok(path) => serve_file(stream, method, &path),
        Err(ServerError::Forbidden) => {
            write_response(stream, 403, "forbidden", "text/plain; charset=utf-8", false)
        }
        Err(ServerError::BadRequest(_)) => write_response(
            stream,
            400,
            "bad request",
            "text/plain; charset=utf-8",
            false,
        ),
        Err(error) => Err(error),
    }
}

fn read_request(stream: &mut TcpStream) -> Result<String, ServerError> {
    let mut buffer = [0u8; READ_LIMIT];
    let len = stream.read(&mut buffer)?;
    if len == 0 {
        return Err(ServerError::BadRequest("empty request".to_string()));
    }
    String::from_utf8(buffer[..len].to_vec())
        .map_err(|_| ServerError::BadRequest("request is not utf-8".to_string()))
}

#[derive(Debug, Eq, PartialEq)]
struct RequestLine<'a> {
    method: &'a str,
    target: &'a str,
}

fn parse_request_line(line: &str) -> Result<RequestLine<'_>, ServerError> {
    let mut parts = line.split_whitespace();
    let method = parts
        .next()
        .ok_or_else(|| ServerError::BadRequest("missing method".to_string()))?;
    let target = parts
        .next()
        .ok_or_else(|| ServerError::BadRequest("missing target".to_string()))?;
    let version = parts
        .next()
        .ok_or_else(|| ServerError::BadRequest("missing version".to_string()))?;
    if parts.next().is_some() || !version.starts_with("HTTP/") {
        return Err(ServerError::BadRequest("invalid request line".to_string()));
    }
    Ok(RequestLine { method, target })
}

fn resolve_path(root: &Path, target: &str) -> Result<PathBuf, ServerError> {
    let path_part = target.split('?').next().unwrap_or(target);
    let decoded = percent_decode(path_part)?;
    let mut relative = decoded.trim_start_matches('/').to_string();
    if relative.is_empty() || relative.ends_with('/') {
        relative.push_str("index.html");
    }
    if relative.contains('\\') || relative.contains(':') {
        return Err(ServerError::Forbidden);
    }

    let relative_path = Path::new(&relative);
    if relative_path.is_absolute() {
        return Err(ServerError::Forbidden);
    }
    for component in relative_path.components() {
        match component {
            Component::Normal(_) => {}
            _ => return Err(ServerError::Forbidden),
        }
    }

    Ok(root.join(relative_path))
}

fn percent_decode(input: &str) -> Result<String, ServerError> {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        match bytes[index] {
            b'%' => {
                if index + 2 >= bytes.len() {
                    return Err(ServerError::BadRequest(
                        "incomplete percent escape".to_string(),
                    ));
                }
                let high = hex_value(bytes[index + 1])
                    .ok_or_else(|| ServerError::BadRequest("bad percent escape".to_string()))?;
                let low = hex_value(bytes[index + 2])
                    .ok_or_else(|| ServerError::BadRequest("bad percent escape".to_string()))?;
                out.push((high << 4) | low);
                index += 3;
            }
            value => {
                out.push(value);
                index += 1;
            }
        }
    }
    String::from_utf8(out)
        .map_err(|_| ServerError::BadRequest("decoded path is not utf-8".to_string()))
}

fn hex_value(value: u8) -> Option<u8> {
    match value {
        b'0'..=b'9' => Some(value - b'0'),
        b'a'..=b'f' => Some(value - b'a' + 10),
        b'A'..=b'F' => Some(value - b'A' + 10),
        _ => None,
    }
}

fn serve_file(stream: &mut TcpStream, method: Method, path: &Path) -> Result<(), ServerError> {
    let metadata = match path.metadata() {
        Ok(metadata) if metadata.is_file() => metadata,
        _ => {
            write_response(stream, 404, "not found", "text/plain; charset=utf-8", false)?;
            return Ok(());
        }
    };

    let mime = content_type(path);
    write!(
        stream,
        "HTTP/1.1 200 OK\r\ncontent-type: {mime}\r\ncontent-length: {}\r\nconnection: close\r\n\r\n",
        metadata.len()
    )?;
    if method == Method::Head {
        stream.flush()?;
        return Ok(());
    }

    let mut file = File::open(path)?;
    let mut buffer = [0u8; 64 * 1024];
    loop {
        let len = file.read(&mut buffer)?;
        if len == 0 {
            break;
        }
        stream.write_all(&buffer[..len])?;
    }
    stream.flush()?;
    Ok(())
}

fn write_response(
    stream: &mut TcpStream,
    code: u16,
    body: &str,
    content_type: &str,
    head_only: bool,
) -> Result<(), ServerError> {
    let reason = match code {
        400 => "Bad Request",
        403 => "Forbidden",
        404 => "Not Found",
        405 => "Method Not Allowed",
        500 => "Internal Server Error",
        _ => "OK",
    };
    write!(
        stream,
        "HTTP/1.1 {code} {reason}\r\ncontent-type: {content_type}\r\ncontent-length: {}\r\nconnection: close\r\n\r\n",
        body.len()
    )?;
    if !head_only {
        stream.write_all(body.as_bytes())?;
    }
    stream.flush()?;
    Ok(())
}

fn content_type(path: &Path) -> &'static str {
    match path.extension().and_then(|ext| ext.to_str()).unwrap_or("") {
        "css" => "text/css; charset=utf-8",
        "html" => "text/html; charset=utf-8",
        "js" => "text/javascript; charset=utf-8",
        "json" => "application/json; charset=utf-8",
        "manifest" => "text/plain; charset=utf-8",
        "md" => "text/plain; charset=utf-8",
        "slm" => "application/octet-stream",
        "txt" => "text/plain; charset=utf-8",
        "wasm" => "application/wasm",
        _ => "application/octet-stream",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_get_request_line() {
        let line = parse_request_line("GET /app/ HTTP/1.1").expect("request line");
        assert_eq!(line.method, "GET");
        assert_eq!(line.target, "/app/");
    }

    #[test]
    fn resolves_directory_to_index() {
        let root = Path::new("tinyrustlm");
        let path = resolve_path(root, "/app/").expect("path");
        assert!(path.ends_with(Path::new("app").join("index.html")));
    }

    #[test]
    fn rejects_traversal() {
        let root = Path::new("tinyrustlm");
        assert!(matches!(
            resolve_path(root, "/../Cargo.toml"),
            Err(ServerError::Forbidden)
        ));
    }

    #[test]
    fn decodes_percent_paths() {
        assert_eq!(percent_decode("/app/app%2Ejs").unwrap(), "/app/app.js");
    }

    #[test]
    fn reports_wasm_content_type() {
        assert_eq!(
            content_type(Path::new("runtime/tinyrustlm.wasm")),
            "application/wasm"
        );
    }
}
