// test-secrets.js - File with fake secrets for testing

const config = {
    // High risk secrets
    stripe: "sk_live_abcdefghijklmnopqrstuvwxyz1234567890",
    aws: "AKIAIOSFODNN7EXAMPLE",
    database: "postgres://user:password@localhost:5432/mydb",

    // Medium risk
    openai: "sk-abcdefghijklmnopqrstuvwxyz1234567890abcdefghijkl",
    github: "ghp_abcdefghijklmnopqrstuvwxyz1234567890",

    // Low risk
    stripe_test: "sk_test_abcdefghijklmnopqrstuvwxyz1234567890",
    google: "AIzaSyAbcdefghijklmnopqrstuvwxyz12345",
};

// This should trigger our scanner
console.log("Testing secrets detection...");