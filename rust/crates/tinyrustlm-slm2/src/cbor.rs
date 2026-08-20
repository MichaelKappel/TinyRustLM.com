use std::cmp::Ordering;

use crate::Slm2Error;

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) enum Value {
    Unsigned(u64),
    Negative(i64),
    Bytes(Vec<u8>),
    Text(String),
    Array(Vec<Value>),
    Map(Vec<(String, Value)>),
    Bool(bool),
    Null,
}

#[derive(Clone, Copy)]
pub(crate) struct Limits {
    pub(crate) maximum_depth: usize,
    pub(crate) maximum_items: usize,
    pub(crate) maximum_map_entries: usize,
    pub(crate) maximum_array_entries: usize,
    pub(crate) maximum_byte_string_bytes: usize,
    pub(crate) maximum_text_bytes: usize,
}

pub(crate) const PROFILE_LIMITS: Limits = Limits {
    maximum_depth: 16,
    maximum_items: 65_536,
    maximum_map_entries: 4_096,
    maximum_array_entries: 65_536,
    maximum_byte_string_bytes: 4_194_304,
    maximum_text_bytes: 16_384,
};

pub(crate) fn decode_exact(bytes: &[u8], limits: Limits) -> Result<Value, Slm2Error> {
    let mut decoder = Decoder {
        bytes,
        position: 0,
        items: 0,
        limits,
    };
    let value = decoder.decode_value(1)?;
    if decoder.position != bytes.len() {
        return Err(invalid());
    }
    Ok(value)
}

pub(crate) fn encode(value: &Value, limits: Limits) -> Result<Vec<u8>, Slm2Error> {
    let mut output = Vec::new();
    encode_value(value, &mut output)?;
    decode_exact(&output, limits)?;
    Ok(output)
}

pub(crate) fn map(entries: Vec<(&str, Value)>) -> Value {
    Value::Map(
        entries
            .into_iter()
            .map(|(key, value)| (key.to_owned(), value))
            .collect(),
    )
}

impl Value {
    pub(crate) fn as_map(&self) -> Result<&[(String, Value)], Slm2Error> {
        match self {
            Self::Map(entries) => Ok(entries),
            _ => Err(invalid()),
        }
    }

    pub(crate) fn as_array(&self) -> Result<&[Value], Slm2Error> {
        match self {
            Self::Array(values) => Ok(values),
            _ => Err(invalid()),
        }
    }

    pub(crate) fn as_unsigned(&self) -> Result<u64, Slm2Error> {
        match self {
            Self::Unsigned(value) => Ok(*value),
            _ => Err(invalid()),
        }
    }

    pub(crate) fn as_text(&self) -> Result<&str, Slm2Error> {
        match self {
            Self::Text(value) => Ok(value),
            _ => Err(invalid()),
        }
    }

    pub(crate) fn as_bytes(&self) -> Result<&[u8], Slm2Error> {
        match self {
            Self::Bytes(value) => Ok(value),
            _ => Err(invalid()),
        }
    }

    pub(crate) fn as_bool(&self) -> Result<bool, Slm2Error> {
        match self {
            Self::Bool(value) => Ok(*value),
            _ => Err(invalid()),
        }
    }
}

struct Decoder<'a> {
    bytes: &'a [u8],
    position: usize,
    items: usize,
    limits: Limits,
}

impl Decoder<'_> {
    fn decode_value(&mut self, depth: usize) -> Result<Value, Slm2Error> {
        self.count_item(depth)?;
        let initial = self.read_byte()?;
        let major = initial >> 5;
        let additional = initial & 0x1f;
        match major {
            0 => Ok(Value::Unsigned(self.decode_argument(additional)?)),
            1 => {
                let argument = self.decode_argument(additional)?;
                let magnitude = i64::try_from(argument).map_err(|_| invalid())?;
                Ok(Value::Negative(-1 - magnitude))
            }
            2 => {
                let length =
                    self.decode_length(additional, self.limits.maximum_byte_string_bytes)?;
                Ok(Value::Bytes(self.read_exact(length)?.to_vec()))
            }
            3 => {
                let length = self.decode_length(additional, self.limits.maximum_text_bytes)?;
                let raw = self.read_exact(length)?;
                let text = std::str::from_utf8(raw).map_err(|_| invalid())?;
                if !text.is_ascii() {
                    return Err(invalid());
                }
                Ok(Value::Text(text.to_owned()))
            }
            4 => {
                let count = self.decode_length(additional, self.limits.maximum_array_entries)?;
                self.preflight_items(count)?;
                let mut values = Vec::with_capacity(count);
                for _ in 0..count {
                    values.push(self.decode_value(depth + 1)?);
                }
                Ok(Value::Array(values))
            }
            5 => self.decode_map(additional, depth),
            7 => match additional {
                20 => Ok(Value::Bool(false)),
                21 => Ok(Value::Bool(true)),
                22 => Ok(Value::Null),
                _ => Err(invalid()),
            },
            _ => Err(invalid()),
        }
    }

    fn decode_map(&mut self, additional: u8, depth: usize) -> Result<Value, Slm2Error> {
        let count = self.decode_length(additional, self.limits.maximum_map_entries)?;
        let doubled = count.checked_mul(2).ok_or_else(invalid)?;
        self.preflight_items(doubled)?;
        let mut entries = Vec::with_capacity(count);
        let mut prior_key_encoding: Option<Vec<u8>> = None;
        for _ in 0..count {
            let key_start = self.position;
            let key = match self.decode_value(depth + 1)? {
                Value::Text(value) => value,
                _ => return Err(invalid()),
            };
            let key_encoding = self.bytes[key_start..self.position].to_vec();
            if let Some(prior) = prior_key_encoding.as_deref() {
                if compare_encoded_keys(prior, &key_encoding) != Ordering::Less {
                    return Err(invalid());
                }
            }
            prior_key_encoding = Some(key_encoding);
            let value = self.decode_value(depth + 1)?;
            entries.push((key, value));
        }
        Ok(Value::Map(entries))
    }

    fn count_item(&mut self, depth: usize) -> Result<(), Slm2Error> {
        if depth > self.limits.maximum_depth {
            return Err(invalid());
        }
        self.items = self.items.checked_add(1).ok_or_else(invalid)?;
        if self.items > self.limits.maximum_items {
            return Err(invalid());
        }
        Ok(())
    }

    fn preflight_items(&self, additional: usize) -> Result<(), Slm2Error> {
        if self
            .items
            .checked_add(additional)
            .filter(|total| *total <= self.limits.maximum_items)
            .is_none()
        {
            return Err(invalid());
        }
        Ok(())
    }

    fn decode_length(&mut self, additional: u8, maximum: usize) -> Result<usize, Slm2Error> {
        let value = self.decode_argument(additional)?;
        let length = usize::try_from(value).map_err(|_| invalid())?;
        if length > maximum || length > self.bytes.len().saturating_sub(self.position) {
            return Err(invalid());
        }
        Ok(length)
    }

    fn decode_argument(&mut self, additional: u8) -> Result<u64, Slm2Error> {
        let value = match additional {
            0..=23 => u64::from(additional),
            24 => u64::from(self.read_byte()?),
            25 => u64::from(u16::from_be_bytes(self.read_array()?)),
            26 => u64::from(u32::from_be_bytes(self.read_array()?)),
            27 => u64::from_be_bytes(self.read_array()?),
            _ => return Err(invalid()),
        };
        let shortest = match additional {
            0..=23 => true,
            24 => value >= 24,
            25 => value > u64::from(u8::MAX),
            26 => value > u64::from(u16::MAX),
            27 => value > u64::from(u32::MAX),
            _ => false,
        };
        if !shortest {
            return Err(invalid());
        }
        Ok(value)
    }

    fn read_byte(&mut self) -> Result<u8, Slm2Error> {
        let byte = *self.bytes.get(self.position).ok_or_else(invalid)?;
        self.position += 1;
        Ok(byte)
    }

    fn read_exact(&mut self, length: usize) -> Result<&[u8], Slm2Error> {
        let end = self.position.checked_add(length).ok_or_else(invalid)?;
        let value = self.bytes.get(self.position..end).ok_or_else(invalid)?;
        self.position = end;
        Ok(value)
    }

    fn read_array<const N: usize>(&mut self) -> Result<[u8; N], Slm2Error> {
        self.read_exact(N)?.try_into().map_err(|_| invalid())
    }
}

fn encode_value(value: &Value, output: &mut Vec<u8>) -> Result<(), Slm2Error> {
    match value {
        Value::Unsigned(value) => encode_head(0, *value, output),
        Value::Negative(value) => {
            if *value >= 0 {
                return Err(invalid());
            }
            let argument = u64::try_from(-1_i128 - i128::from(*value)).map_err(|_| invalid())?;
            encode_head(1, argument, output);
        }
        Value::Bytes(bytes) => {
            encode_head(
                2,
                u64::try_from(bytes.len()).map_err(|_| invalid())?,
                output,
            );
            output.extend_from_slice(bytes);
        }
        Value::Text(text) => {
            if !text.is_ascii() {
                return Err(invalid());
            }
            encode_head(3, u64::try_from(text.len()).map_err(|_| invalid())?, output);
            output.extend_from_slice(text.as_bytes());
        }
        Value::Array(values) => {
            encode_head(
                4,
                u64::try_from(values.len()).map_err(|_| invalid())?,
                output,
            );
            for value in values {
                encode_value(value, output)?;
            }
        }
        Value::Map(entries) => {
            let mut ordered = Vec::with_capacity(entries.len());
            for (key, value) in entries {
                if !key.is_ascii() {
                    return Err(invalid());
                }
                let mut encoded_key = Vec::new();
                encode_value(&Value::Text(key.clone()), &mut encoded_key)?;
                ordered.push((encoded_key, value));
            }
            ordered.sort_by(|left, right| compare_encoded_keys(&left.0, &right.0));
            if ordered
                .windows(2)
                .any(|pair| compare_encoded_keys(&pair[0].0, &pair[1].0) != Ordering::Less)
            {
                return Err(invalid());
            }
            encode_head(
                5,
                u64::try_from(ordered.len()).map_err(|_| invalid())?,
                output,
            );
            for (encoded_key, value) in ordered {
                output.extend_from_slice(&encoded_key);
                encode_value(value, output)?;
            }
        }
        Value::Bool(false) => output.push(0xf4),
        Value::Bool(true) => output.push(0xf5),
        Value::Null => output.push(0xf6),
    }
    Ok(())
}

fn encode_head(major: u8, argument: u64, output: &mut Vec<u8>) {
    let prefix = major << 5;
    match argument {
        0..=23 => output.push(prefix | argument as u8),
        24..=0xff => {
            output.push(prefix | 24);
            output.push(argument as u8);
        }
        0x100..=0xffff => {
            output.push(prefix | 25);
            output.extend_from_slice(&(argument as u16).to_be_bytes());
        }
        0x1_0000..=0xffff_ffff => {
            output.push(prefix | 26);
            output.extend_from_slice(&(argument as u32).to_be_bytes());
        }
        _ => {
            output.push(prefix | 27);
            output.extend_from_slice(&argument.to_be_bytes());
        }
    }
}

fn compare_encoded_keys(left: &[u8], right: &[u8]) -> Ordering {
    left.len().cmp(&right.len()).then_with(|| left.cmp(right))
}

const fn invalid() -> Slm2Error {
    Slm2Error::new("slm2-invalid-metadata")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deterministic_map_round_trips_in_length_first_order() {
        let value = map(vec![
            ("longer", Value::Unsigned(2)),
            ("a", Value::Unsigned(1)),
            ("bb", Value::Bool(true)),
        ]);
        let encoded = encode(&value, PROFILE_LIMITS).unwrap();
        let decoded = decode_exact(&encoded, PROFILE_LIMITS).unwrap();
        assert_eq!(encode(&decoded, PROFILE_LIMITS).unwrap(), encoded);
        assert_eq!(encoded[0], 0xa3);
        assert_eq!(&encoded[1..3], &[0x61, b'a']);
    }

    #[test]
    fn rejects_nonshortest_duplicate_indefinite_float_tag_and_trailing() {
        for bytes in [
            vec![0x18, 0x01],
            vec![0xa2, 0x61, b'a', 0x01, 0x61, b'a', 0x02],
            vec![0x9f, 0xff],
            vec![0xf9, 0x00, 0x00],
            vec![0xc0, 0x00],
            vec![0x00, 0x00],
        ] {
            assert_eq!(
                decode_exact(&bytes, PROFILE_LIMITS).unwrap_err().code(),
                "slm2-invalid-metadata"
            );
        }
    }

    #[test]
    fn rejects_non_ascii_text_and_non_text_map_keys() {
        assert!(decode_exact(&[0x62, 0xc3, 0xa9], PROFILE_LIMITS).is_err());
        assert!(decode_exact(&[0xa1, 0x01, 0x01], PROFILE_LIMITS).is_err());
    }

    #[test]
    fn enforces_depth_and_item_limits_before_allocation() {
        let limits = Limits {
            maximum_depth: 2,
            maximum_items: 3,
            maximum_map_entries: 2,
            maximum_array_entries: 2,
            maximum_byte_string_bytes: 2,
            maximum_text_bytes: 2,
        };
        assert!(decode_exact(&[0x81, 0x81, 0x00], limits).is_err());
        assert!(decode_exact(&[0x83, 0x00, 0x00, 0x00], limits).is_err());
        assert!(decode_exact(&[0x43, 0x00, 0x00, 0x00], limits).is_err());
    }
}
