//! Gemini AI client for chatbot integration.
//! Handles communication with the Google Gemini API.

use reqwest;
use serde::{Deserialize, Serialize};
use std::env;

const GEMINI_API_BASE_URL: &str = "https://generativelanguage.googleapis.com/v1beta/models/";

#[derive(Serialize)]
struct GeminiRequest {
    contents: Vec<Content>,
}

#[derive(Serialize)]
struct Content {
    parts: Vec<Part>,
}

#[derive(Serialize)]
struct Part {
    text: String,
}

#[derive(Deserialize, Debug)]
struct GeminiResponse {
    candidates: Vec<Candidate>,
}

#[derive(Deserialize, Debug)]
struct Candidate {
    content: ContentResponse,
}

#[derive(Deserialize, Debug)]
struct ContentResponse {
    parts: Vec<PartResponse>,
    role: String,
}

#[derive(Deserialize, Debug)]
struct PartResponse {
    text: String,
}

/// Get a response from the Gemini Pro model.
pub async fn get_gemini_response(prompt: &str) -> Result<String, reqwest::Error> {
    let api_key = env::var("GEMINI_API_KEY").expect("GEMINI_API_KEY must be set");
    let model = "gemini-pro:generateContent";
    let url = format!("{}{}", GEMINI_API_BASE_URL, model);

    let client = reqwest::Client::new();

    let request_body = GeminiRequest {
        contents: vec![Content {
            parts: vec![Part {
                text: prompt.to_string(),
            }],
        }],
    };

    let res = client
        .post(&url)
        .header("Content-Type", "application/json")
        .query(&[("key", &api_key)])
        .json(&request_body)
        .send()
        .await?;

    if res.status().is_success() {
        let gemini_response: GeminiResponse = res.json().await?;
        if let Some(candidate) = gemini_response.candidates.get(0) {
            if let Some(part) = candidate.content.parts.get(0) {
                return Ok(part.text.clone());
            }
        }
        Ok("No response from Gemini.".to_string())
    } else {
        let error_body = res.text().await?;
        eprintln!("Gemini API Error: {}", error_body);
        Ok(format!("Error: {}", error_body))
    }
}
