use axum::{
    extract::{Path, State},
    Json,
    http::StatusCode,
};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

use crate::models::user::User;

#[derive(Debug, Deserialize)]
pub struct CreateUserDto {
    pub name: String,
    pub email: String,
}

pub async fn list_users(State(pool): State<SqlitePool>) -> Result<Json<Vec<User>>, StatusCode> {
    let users = sqlx::query_as::<_, User>("SELECT * FROM users")
        .fetch_all(&pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(users))
}

pub async fn get_user(
    Path(id): Path<i32>,
    State(pool): State<SqlitePool>,
) -> Result<Json<User>, StatusCode> {
    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = ?")
        .bind(id)
        .fetch_optional(&pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    match user {
        Some(user) => Ok(Json(user)),
        None => Err(StatusCode::NOT_FOUND),
    }
}

pub async fn create_user(
    State(pool): State<SqlitePool>,
    Json(dto): Json<CreateUserDto>,
) -> Result<Json<User>, StatusCode> {
    let user = sqlx::query_as::<_, User>(
        "INSERT INTO users (name, email) VALUES (?, ?) RETURNING *"
    )
    .bind(&dto.name)
    .bind(&dto.email)
    .fetch_one(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(user))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{routing::{get, post}, Router};
    use tower::ServiceExt;
    use http::{Request, Method};
    use http_body_util::Full;
    use axum::body::Body;

    async fn create_test_app() -> Router {
        let pool = sqlx::SqlitePool::connect(":memory:").await.unwrap();

        sqlx::query(
            "CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT)"
        )
        .execute(&pool)
        .await
        .unwrap();

        Router::new()
            .route("/users", get(list_users).post(create_user))
            .route("/users/:id", get(get_user))
            .with_state(pool)
    }

    #[tokio::test]
    async fn test_list_empty_users() {
        let app = create_test_app().await;

        let response = app
            .oneshot(
                Request::builder()
                    .method(Method::GET)
                    .uri("/users")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);

        let body = hyper::body::to_bytes(response.into_body()).await.unwrap();
        let users: Vec<User> = serde_json::from_slice(&body).unwrap();

        assert!(users.is_empty());
    }

    #[tokio::test]
    async fn test_create_user() {
        let app = create_test_app().await;

        let payload = serde_json::to_vec(&CreateUserDto {
            name: "Test User".to_string(),
            email: "test@example.com".to_string(),
        }).unwrap();

        let response = app
            .oneshot(
                Request::builder()
                    .method(Method::POST)
                    .uri("/users")
                    .header("content-type", "application/json")
                    .body(Body::from(payload))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }
}
