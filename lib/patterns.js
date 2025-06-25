// lib/patterns.js

export const secretPatterns = {
    stripe_live: {
        pattern: /sk_live_[a-zA-Z0-9]{24}/g,
        description: "Stripe live API key",
        suggestion: "Move to .env file - this exposes real payment processing!"
    },
    stripe_test: {
        pattern: /sk_test_[a-zA-Z0-9]{24}/g,
        description: "Stripe test API key",
        suggestion: "Move to .env file for consistency"
    },
    openai: {
        pattern: /sk-[a-zA-Z0-9]{48}/g,
        description: "OpenAI API key",
        suggestion: "Move to .env file - this costs money per request!"
    },
    aws_access: {
        pattern: /AKIA[0-9A-Z]{16}/g,
        description: "AWS Access Key",
        suggestion: "Move to .env file - this can access your entire AWS account!"
    },
    github_token: {
        pattern: /ghp_[a-zA-Z0-9]{36}/g,
        description: "GitHub Personal Access Token",
        suggestion: "Move to .env file - this can access your repos!"
    },
    google_api: {
        pattern: /AIza[0-9A-Za-z\\-_]{35}/g,
        description: "Google API Key",
        suggestion: "Move to .env file"
    },
    jwt_secret: {
        pattern: /['"](.*jwt.*secret.*|.*secret.*jwt.*)['"]\s*[=:]\s*['"][^'"]{32,}['"]/gi,
        description: "JWT Secret",
        suggestion: "Move to .env file - this compromises all your user sessions!"
    },
    database_url: {
        pattern: /(mongodb|postgres|mysql):\/\/[^'"\s]+/g,
        description: "Database connection string",
        suggestion: "Move to .env file - this exposes your database!"
    }
};

export const gitignoreTemplates = {
    node: [
        '.env*',
        'node_modules/',
        '.DS_Store',
        'npm-debug.log*',
        'dist/',
        'build/',
        '*.log'
    ],
    python: [
        '.env*',
        '__pycache__/',
        '*.pyc',
        '*.pyo',
        '*.pyd',
        '.Python',
        'venv/',
        'env/',
        'pip-log.txt'
    ],
    php: [
        '.env*',
        'vendor/',
        '*.log',
        '.DS_Store'
    ],
    ruby: [
        '.env*',
        '.bundle/',
        'vendor/',
        '*.log',
        '.DS_Store'
    ],
    java: [
        '.env*',
        'target/',
        '*.class',
        '*.log',
        '.DS_Store'
    ],
    generic: [
        '.env*',
        '*.log',
        '.DS_Store',
        'secrets.json',
        'config.json'
    ]
};

export const sensitiveFiles = [
    '.env*',           // Catches .env, .env.test, .env.local, etc.
    'secrets.json',
    'config.json',
    'credentials.json',
    'private.key',
    '*.pem',
    'id_rsa',
    'id_dsa'
];

export const fileExtensions = [
    '.js', '.ts', '.jsx', '.tsx',
    '.py', '.rb', '.php', '.java',
    '.env', '.json', '.yaml', '.yml',
    '.txt', '.md', '.config'
];

export const ignoreDirs = [
    'node_modules',
    '.git',
    'dist',
    'build',
    '__pycache__',
    'vendor',
    '.venv',
    'env',
    'target'
];