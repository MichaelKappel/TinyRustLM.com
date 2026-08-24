use serde::de::DeserializeOwned;
use serde::Serialize;
use std::ffi::CString;
use std::os::raw::c_char;

const SERIALIZATION_FAILURE: &[u8] =
    br#"{"ok":false,"value":null,"error":{"code":"native-serialization"}}"#;

pub(crate) type NativeResult<T> = Result<T, NativeError>;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) struct NativeError {
    code: &'static str,
}

impl NativeError {
    pub(crate) const fn new(code: &'static str) -> Self {
        Self { code }
    }

    pub(crate) const fn code(self) -> &'static str {
        self.code
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Envelope<T> {
    ok: bool,
    value: Option<T>,
    error: Option<ErrorEnvelope>,
}

#[derive(Serialize)]
struct ErrorEnvelope {
    code: &'static str,
}

pub(crate) fn parse_json<T: DeserializeOwned>(bytes: &[u8]) -> NativeResult<T> {
    if bytes.is_empty() {
        return Err(NativeError::new("native-input-empty"));
    }
    serde_json::from_slice(bytes).map_err(|_| NativeError::new("native-json"))
}

pub(crate) fn json<T: Serialize>(result: NativeResult<T>) -> *mut c_char {
    let envelope = match result {
        Ok(value) => Envelope {
            ok: true,
            value: Some(value),
            error: None,
        },
        Err(error) => Envelope {
            ok: false,
            value: None,
            error: Some(ErrorEnvelope { code: error.code() }),
        },
    };
    let bytes = serde_json::to_vec(&envelope).unwrap_or_else(|_| SERIALIZATION_FAILURE.to_vec());
    into_raw_c_string(bytes)
}

pub(crate) fn error(code: &'static str) -> *mut c_char {
    json::<()>(Err(NativeError::new(code)))
}

fn into_raw_c_string(bytes: Vec<u8>) -> *mut c_char {
    CString::new(bytes).unwrap_or_default().into_raw()
}
