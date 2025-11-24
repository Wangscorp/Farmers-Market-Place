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
}

#[derive(Deserialize, Debug)]
struct PartResponse {
    text: String,
}

/// Get a response from the Gemini Pro model.
pub async fn get_gemini_response(prompt: &str) -> Result<String, Box<dyn std::error::Error>> {
    let api_key = match env::var("GEMINI_API_KEY") {
        Ok(key) => key,
        Err(_) => {
            return Ok("I'm sorry, but the AI chatbot is currently unavailable. The administrator needs to configure the Gemini API key. Please try again later or contact support for assistance.".to_string());
        }
    };
    let model = "gemini-1.5-flash:generateContent";
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
        .await
        .map_err(|e| Box::new(e) as Box<dyn std::error::Error>)?;

    if res.status().is_success() {
        let gemini_response: GeminiResponse = res.json().await
            .map_err(|e| Box::new(e) as Box<dyn std::error::Error>)?;
        if let Some(candidate) = gemini_response.candidates.get(0) {
            if let Some(part) = candidate.content.parts.get(0) {
                return Ok(part.text.clone());
            }
        }
        Ok("No response from Gemini.".to_string())
    } else {
        let error_body = res.text().await
            .map_err(|e| Box::new(e) as Box<dyn std::error::Error>)?;
        eprintln!("Gemini API Error: {}", error_body);
        Ok(format!("Error: {}", error_body))
    }
}
