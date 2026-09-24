use base64::Engine;
use edge_tts_rust::{Boundary, EdgeTtsClient, SpeakOptions};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct EdgeVoiceInfo {
    pub id: String,
    pub name: String,
    pub lang: String,
    pub gender: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WordBoundaryInfo {
    pub offset_ms: u64,
    pub duration_ms: u64,
    pub text: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EdgeSpeakResult {
    pub audio_base64: String,
    pub boundaries: Vec<WordBoundaryInfo>,
}

#[tauri::command]
async fn get_edge_voices() -> Result<Vec<EdgeVoiceInfo>, String> {
    let client = EdgeTtsClient::new().map_err(|e| e.to_string())?;
    let voices = client.list_voices().await.map_err(|e| e.to_string())?;

    // Filter to Japanese and English voices
    let filtered: Vec<EdgeVoiceInfo> = voices
        .into_iter()
        .filter(|v| {
            let loc = v.locale.to_lowercase();
            loc.starts_with("ja-") || loc.starts_with("en-")
        })
        .map(|v| {
            let raw_name = v.friendly_name.unwrap_or_else(|| v.short_name.clone());
            let clean_name = raw_name
                .replace("Microsoft ", "")
                .replace(" Online (Natural)", "")
                .replace(" - Japanese (Japan)", "")
                .replace(" - English (United States)", " (US)")
                .replace(" - English (United Kingdom)", " (UK)")
                .replace(" - English (Australia)", " (AU)")
                .replace(" - English (Canada)", " (CA)");
            let gender = if v.gender.is_empty() { "Unknown".to_string() } else { v.gender };
            EdgeVoiceInfo {
                id: v.short_name.clone(),
                name: format!("{} ({})", clean_name, gender),
                lang: v.locale,
                gender,
            }
        })
        .collect();

    Ok(filtered)
}

#[tauri::command]
async fn speak_edge_tts(
    text: String,
    voice: String,
    speed: f32,
) -> Result<EdgeSpeakResult, String> {
    let client = EdgeTtsClient::new().map_err(|e| e.to_string())?;

    // speed rate formatting (e.g. 1.0 -> "+0%", 1.2 -> "+20%", 0.8 -> "-20%")
    let rate_pct = ((speed - 1.0) * 100.0).round() as i32;
    let rate_str = if rate_pct >= 0 {
        format!("+{}%", rate_pct)
    } else {
        format!("{}%", rate_pct)
    };

    let selected_voice = if voice.is_empty() {
        "ja-JP-NanamiNeural".to_string()
    } else {
        voice
    };

    let options = SpeakOptions {
        voice: selected_voice,
        rate: rate_str,
        boundary: Boundary::Word,
        ..Default::default()
    };

    let result = client.synthesize(&text, options).await.map_err(|e| e.to_string())?;

    let audio_base64 = base64::engine::general_purpose::STANDARD.encode(&result.audio);

    let boundaries = result
        .boundaries
        .into_iter()
        .map(|b| WordBoundaryInfo {
            offset_ms: b.offset_ticks / 10_000, // 100ns -> ms
            duration_ms: b.duration_ticks / 10_000,
            text: b.text,
        })
        .collect();

    Ok(EdgeSpeakResult {
        audio_base64,
        boundaries,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .invoke_handler(tauri::generate_handler![get_edge_voices, speak_edge_tts])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_edge_tts_voices_and_speak() {
        let voices = get_edge_voices().await.expect("Failed to get edge voices");
        println!("Found {} Japanese/English voices", voices.len());
        assert!(!voices.is_empty());

        let res = speak_edge_tts("こんにちは、世界。".to_string(), "ja-JP-NanamiNeural".to_string(), 1.0)
            .await
            .expect("Failed to speak edge tts");
        assert!(!res.audio_base64.is_empty());
        println!("Audio base64 len: {}, boundaries: {}", res.audio_base64.len(), res.boundaries.len());
    }
}
