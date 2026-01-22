# SO360 CRM - Customer Relationship Management Module

A standalone Micro Frontend (MFE) for the SO360 platform, built with React, Vite, and Module Federation.

## 🏗️ Architecture

This is a **remote application** in the Module Federation architecture:
- **Name**: `crm_app`
- **Port**: `3004`
- **Exposes**: `./App` component
- **Consumes**: Shared context from `@so360/shell-context`

## 📦 Prerequisites

- Node.js >= 14
- npm >= 6
- Access to `so360-shell-fe` repository (for shared packages)

## 🚀 Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Link Shared Packages

The CRM app depends on shared packages from the Shell repository. Make sure the Shell repo is set up:

```bash
# In the shell-fe repo
cd ../so360-shell-fe/packages/shell-context
npm run build

cd ../design-system
npm run build

cd ../event-bus
npm run build
```

### 3. Development

Start the dev server:

```bash
npm run dev
```

The app will run on `http://localhost:3004`

### 4. Production Build

```bash
npm run build
```

Outputs to `dist/` directory with `remoteEntry.js` for Module Federation.

## 🔗 Integration with Shell

The Shell application loads this MFE via Module Federation:

```typescript
// Shell's vite.config.ts
remotes: {
  crm_app: 'http://localhost:3004/assets/remoteEntry.js',
}
```

## 📁 Project Structure

```
so360-crm/
├── src/
│   ├── App.tsx           # Main application component (exposed to Shell)
│   └── main.tsx          # Standalone dev entry point
├── vite.config.ts        # Vite + Module Federation config
├── package.json
└── README.md
```

## 🎨 Shared Dependencies

This MFE uses the following shared packages:

- `@so360/shell-context` - Context hooks (`useIdentity`, `useTenant`, etc.)
- `@so360/design-system` - Shared UI components
- `@so360/event-bus` - Cross-module communication

## 🧪 Development Tips

### Standalone Mode
Run `npm run dev` to develop the MFE independently without the Shell.

### Integration Mode
1. Start the Shell: `cd ../so360-shell-fe && npm run dev`
2. Start CRM: `npm run dev`
3. Navigate to `http://localhost:3002/crm` in the Shell

## 📝 Version Compatibility

| CRM Version | Min Shell Version | Max Shell Version |
|-------------|-------------------|-------------------|
| 1.0.0       | 1.0.0             | 2.0.0             |

## 🔒 Security

- All authentication is handled by the Shell
- Backend authorization is the source of truth
- UI permissions are advisory only

## 📄 License

UNLICENSED - Private
