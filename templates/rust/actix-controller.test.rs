#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::{
        body::MessageBody,
        dev::{Service, ServiceResponse},
        http::{header, StatusCode},
        test, web, App,
    };

    /// Helper function to create test app
    async fn create_app() -> App<
        impl Service<
            actix_web::dev::ServiceRequest,
            Response = ServiceResponse<impl MessageBody>,
            Error = actix_web::Error,
        >,
    > {
        test::init_service(
            App::new()
                .route("/health", web::get().to(health_check))
                .route("/api/users", web::get().to(get_users).post(create_user)),
        )
        .await
    }

    /// Test health check endpoint
    #[actix_web::test]
    async fn test_health_check() {
        let app = create_app().await;
        let req = test::TestRequest::get().uri("/health").to_request();

        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), StatusCode::OK);
    }

    /// Test GET /api/users returns 200
    #[actix_web::test]
    async fn test_get_users_returns_200() {
        let app = create_app().await;
        let req = test::TestRequest::get()
            .uri("/api/users")
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), StatusCode::OK);

        // Optionally check response body
        let body = test::read_body(resp).await;
        assert!(!body.is_empty());
    }

    /// Test GET /api/users with pagination
    #[actix_web::test]
    async fn test_get_users_with_pagination() {
        let app = create_app().await;
        let req = test::TestRequest::get()
            .uri("/api/users?page=1&limit=10")
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), StatusCode::OK);
    }

    /// Test POST /api/users with valid data returns 201
    #[actix_web::test]
    async fn test_create_user_with_valid_data_returns_201() {
        let app = create_app().await;
        let payload = serde_json::json!({
            "name": "Test User",
            "email": "test@example.com"
        });

        let req = test::TestRequest::post()
            .uri("/api/users")
            .insert_header((header::CONTENT_TYPE, "application/json"))
            .set_json(&payload)
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), StatusCode::CREATED);
    }

    /// Test POST /api/users with invalid data returns 400
    #[actix_web::test]
    async fn test_create_user_with_invalid_data_returns_400() {
        let app = create_app().await;
        let payload = serde_json::json!({
            "name": ""
        });

        let req = test::TestRequest::post()
            .uri("/api/users")
            .insert_header((header::CONTENT_TYPE, "application/json"))
            .set_json(&payload)
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    }

    /// TODO: Implement handler functions
    async fn health_check() -> &'static str {
        "OK"
    }

    async fn get_users() -> &'static str {
        "[]"
    }

    async fn create_user() -> &'static str {
        "Created"
    }
}
