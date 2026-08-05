use serde::{Deserialize, Serialize};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Tea {
    id: &'static str,
    name: &'static str,
    origin: &'static str,
    price: u32,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct PurchasePayload {
    selected_tea_ids: Vec<String>,
    quantity: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PurchaseReceipt {
    receipt_id: String,
    selected_tea_ids: Vec<String>,
    quantity: u32,
    idempotency_key: Option<String>,
}

#[tauri::command]
fn search_teas(query: Option<String>) -> Vec<Tea> {
    let teas = vec![
        Tea {
            id: "longjing",
            name: "西湖龙井",
            origin: "浙江杭州",
            price: 168,
        },
        Tea {
            id: "tieguanyin",
            name: "安溪铁观音",
            origin: "福建安溪",
            price: 128,
        },
        Tea {
            id: "dahongpao",
            name: "武夷大红袍",
            origin: "福建武夷山",
            price: 198,
        },
    ];
    let normalized = query.unwrap_or_default().to_lowercase();
    if normalized.is_empty() {
        return teas;
    }
    teas.into_iter()
        .filter(|tea| {
            tea.id.contains(&normalized)
                || tea.name.to_lowercase().contains(&normalized)
                || tea.origin.to_lowercase().contains(&normalized)
        })
        .collect()
}

#[tauri::command]
fn create_purchase(
    payload: PurchasePayload,
    idempotency_key: Option<String>,
) -> Result<PurchaseReceipt, String> {
    if payload.selected_tea_ids.is_empty() {
        return Err("at least one tea must be selected".into());
    }
    if payload.quantity == 0 {
        return Err("quantity must be greater than zero".into());
    }
    Ok(PurchaseReceipt {
        receipt_id: "demo-purchase-draft".into(),
        selected_tea_ids: payload.selected_tea_ids,
        quantity: payload.quantity,
        idempotency_key,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![search_teas, create_purchase])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
