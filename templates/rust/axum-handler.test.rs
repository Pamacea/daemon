#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        body::Body,
        http::{Method, Request, StatusCode},
    };
    use tower::ServiceExt;

    /// Helper function to create test app
    async fn create_app() -> Router {
        Router::new()
            .route("/health", get(health_check))
            .route("/api/users", get(get_users).post(create_user))
    }

    /// Test health check endpoint
    #[tokio::test]
    async fn test_health_check() {
        let app = create_app().await;

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/health")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }

    /// Test GET /api/users returns 200
    #[tokio::test]
    async fn test_get_users_returns_200() {
        let app = create_app().await;

        let response = app
            .oneshot(
                Request::builder()
                    .method(Method::GET)
                    .uri("/api/users")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }

    /// Test POST /api/users with valid data returns 201
    #[tokio::test]
    async fn test_create_user_with_valid_data_returns_201() {
        let app = create_app().await;

        let body = serde_json::json!({
            "name": "Test User",
            "email": "test@example.com"
        });

        let response = app
            .oneshot(
                Request::builder()
                    .method(Method::POST)
                    .uri("/api/users")
                    .header("content-type", "application/json")
                    .body(Body::from(body.to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::CREATED);
    }

    /// Test POST /api/users with invalid data returns 400
    #[tokio::test]
    async fn test_create_user_with_invalid_data_returns_400() {
        let app = create_app().await;

        let body = serde_json::json!({
            "name": ""
        });

        let response = app
            .oneshot(
                Request::builder()
                    .method(Method::POST)
                    .uri("/api/users")
                    .header("content-type", "application/json")
                    .body(Body::from(body.to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    /// TODO: Implement handler functions
    async fn health_check() -> StatusCode {
        StatusCode::OK
    }

    async fn get_users() -> StatusCode {
        StatusCode::OK
    }

    async fn create_user() -> StatusCode {
        StatusCode::CREATED
    }

    use axum::{routing::{get, post}, Router};
}
