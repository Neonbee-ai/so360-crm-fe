# SO360 CRM Repository Setup Instructions

## Quick Setup

Run the setup script to create a new repository:

```bash
cd /Users/praveenvr/Work/Projects/so360-shell-fe/crm-setup
./setup.sh
```

This will:
1. Create `/Users/praveenvr/Work/Projects/so360-crm`
2. Initialize a git repository
3. Copy all project files
4. Install dependencies

## Manual Setup (Alternative)

If you prefer manual setup:

```bash
# 1. Create and navigate to target directory
mkdir -p /Users/praveenvr/Work/Projects/so360-crm
cd /Users/praveenvr/Work/Projects/so360-crm

# 2. Initialize git
git init
git branch -M main

# 3. Copy files
cp -r /Users/praveenvr/Work/Projects/so360-shell-fe/crm-setup/* .
cp -r /Users/praveenvr/Work/Projects/so360-shell-fe/crm-setup/.github .
cp /Users/praveenvr/Work/Projects/so360-shell-fe/crm-setup/.gitignore .

# 4. Install dependencies
npm install

# 5. Start development
npm run dev
```

## Post-Setup Steps

### 1. Update package.json
Edit the repository URL in `package.json`:
```json
{
  "repository": {
    "type": "git",
    "url": "https://github.com/your-org/so360-crm.git"
  }
}
```

### 2. Build Shared Packages (First Time)
```bash
# Navigate to shell repo
cd /Users/praveenvr/Work/Projects/so360-shell-fe

# Build each shared package
cd packages/shell-context && npm run build && cd ../..
cd packages/design-system && npm run build && cd ../..
cd packages/event-bus && npm run build && cd ../..
```

### 3. Verify Setup
```bash
cd /Users/praveenvr/Work/Projects/so360-crm
npm run dev
```

Your CRM MFE should now be running on http://localhost:3004

### 4. Test Integration with Shell
```bash
# Terminal 1: Start Shell
cd /Users/praveenvr/Work/Projects/so360-shell-fe
npm run dev  # Runs on port 3002

# Terminal 2: Start CRM
cd /Users/praveenvr/Work/Projects/so360-crm
npm run dev  # Runs on port 3004

# Open browser
# Navigate to http://localhost:3002/crm
```

## Directory Structure

Your new CRM repository will have:

```
so360-crm/
├── .github/
│   └── workflows/
│       └── ci.yml                # GitHub Actions CI
├── public/
│   └── mfe-metadata.json         # MFE metadata for version checking
├── src/
│   ├── App.tsx                   # Main app (exposed to Shell)
│   └── main.tsx                  # Standalone entry point
├── .gitignore
├── index.html
├── package.json
├── README.md
├── tsconfig.json
└── vite.config.ts                # Module Federation config
```

## Publishing Shared Packages (Future)

When ready to publish shared packages to npm:

```bash
# From shell repo
cd packages/shell-context
npm publish

cd ../design-system
npm publish

cd ../event-bus
npm publish
```

Then update CRM's `package.json` to use published versions:
```json
{
  "dependencies": {
    "@so360/shell-context": "^1.0.0",
    "@so360/design-system": "^1.0.0",
    "@so360/event-bus": "^1.0.0"
  }
}
```

## Troubleshooting

### "Cannot find module '@so360/shell-context'"
Run the shared package build steps above.

### Port 3004 already in use
Kill the process or change the port in `vite.config.ts`:
```typescript
server: {
  port: 3005,  // Change port
  cors: true,
}
```

### Build fails with Node version error
Ensure you're using Node 14+ (Node 18+ recommended).

## Next Steps

1. Set up remote git repository
2. Push initial commit
3. Configure CI/CD pipeline
4. Add team members as collaborators
