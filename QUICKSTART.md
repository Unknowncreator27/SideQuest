# SideQuest - Quick Start Guide

## Running the Project

### Option 1: Quick Command (Recommended)
Run this in your terminal from the project root:

**Windows (Batch):**
```bash
dev.bat
```

**Windows (PowerShell):**
```bash
.\dev.ps1
```

**Linux/Mac (if applicable):**
```bash
./dev.ps1
```

---

### Option 2: VS Code Tasks

**Run the build task:**
- Press `Ctrl+Shift+B` (or `Cmd+Shift+B` on Mac)
- Select "Build SideQuest"

**Start the server (after build completes):**
1. Open the Terminal: `Ctrl+Shift+` (backtick)
2. Run Command Palette: `Ctrl+Shift+P`
3. Type "Tasks: Run Task"
4. Select "Start Server"

---

### Option 3: VS Code Debugger
1. Press `F5` or go to Run → Start Debugging
2. Select "SideQuest Server"
3. This will build and start the server with debug support

---

### Option 4: Manual Commands
If you prefer the terminal:
```bash
pnpm run build
node dist/index.js
```

---

## Access the Application
Once running, open your browser to:
```
http://localhost:3001/
```

The server output will show:
```
[OAuth] Initialized with baseURL: http://localhost:3001
Server running on http://localhost:3001/
```

---

## Development Workflow

| Task | Command |
|------|---------|
| **Build & Run** | `dev.bat` or `.\dev.ps1` |
| **Build Only** | `pnpm run build` |
| **Run Only** | `node dist/index.js` |
| **Format Code** | `pnpm run format` |
| **Type Check** | `pnpm run check` |
| **Run Tests** | `pnpm run test` |
| **Sync Database** | `pnpm run db:push` |

---

## Troubleshooting

**"Port 3001 is busy"**
- Change the port in `.env` or close other applications using that port

**"Database connection refused"**
- Ensure MySQL is running with `Get-Service MySQL*`
- Verify `.env` database credentials

**"Module not found"**
- Run `pnpm install` to reinstall dependencies
