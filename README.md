# Cap Table & Dilution Analyzer

An interactive educational tool for modeling venture capital funding rounds, ownership dilution, liquidation preferences, and exit scenarios. Built for entrepreneurial finance courses and entrepreneurs.

## Features

### Core Functionality
- **Dynamic Round Modeling**: Add unlimited funding rounds with customizable parameters
- **Real-time Calculations**: Automatic calculation of share prices, ownership percentages, and dilution
- **Visual Analytics**: Interactive charts showing ownership evolution and valuation growth

### Advanced Financial Modeling
- **Liquidation Preferences**: Model 1x, 2x, or custom preference multiples
- **Participating Preferred**: Toggle participating vs. non-participating preferred stock with participation caps
- **Anti-Dilution Protection**: Full ratchet and weighted average anti-dilution provisions for down rounds
- **Option Pool Dynamics**: Pre-money vs. post-money option pool creation with different dilution effects
- **Pro-Rata Rights**: Model investor rights to maintain ownership percentage in future rounds

### Exit Scenario Analysis
- **Step-by-Step Waterfall**: Visual breakdown of how exit proceeds flow through liquidation preferences
- **Return Calculations**: Automatic calculation of return multiples for each stakeholder
- **Distribution Modeling**: See exactly how much each shareholder receives at different exit valuations

## Deployment to GitHub Pages

### Prerequisites
- Node.js installed (version 14 or higher)
- Git installed
- A GitHub account

### Step 1: Prepare Your Project

Create a new directory and set up the project structure:

```bash
mkdir cap-table-tool
cd cap-table-tool
```

Create the following files:

**package.json**
```json
{
  "name": "cap-table-tool",
  "version": "1.0.0",
  "private": true,
  "homepage": "https://YOUR-GITHUB-USERNAME.github.io/cap-table-tool",
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "recharts": "^2.5.0",
    "lucide-react": "^0.263.1"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "predeploy": "npm run build",
    "deploy": "gh-pages -d build"
  },
  "devDependencies": {
    "react-scripts": "5.0.1",
    "gh-pages": "^5.0.0"
  },
  "eslintConfig": {
    "extends": ["react-app"]
  },
  "browserslist": {
    "production": [">0.2%", "not dead", "not op_mini all"],
    "development": ["last 1 chrome version", "last 1 firefox version", "last 1 safari version"]
  }
}
```

**public/index.html**
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
    <meta name="description" content="Interactive cap table and dilution analyzer for entrepreneurial finance" />
    <title>Cap Table & Dilution Analyzer</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>
```

**src/index.js**
```javascript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**src/App.js**
```javascript
import React from 'react';
import CapTableTool from './CapTableTool';

function App() {
  return <CapTableTool />;
}

export default App;
```

Then copy your `cap_table.jsx` file to `src/CapTableTool.jsx`

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Test Locally

```bash
npm start
```

This opens the app at `http://localhost:3000`. Verify everything works correctly.

### Step 4: Create GitHub Repository

1. Go to [GitHub](https://github.com) and create a new repository named `cap-table-tool`
2. **Important**: Make it public (required for GitHub Pages on free accounts)
3. Don't initialize with README (you already have one)

### Step 5: Deploy to GitHub Pages

Initialize git and push to GitHub:

```bash
# Initialize git repository
git init
git add .
git commit -m "Initial commit: Cap table analyzer"

# Add remote repository (replace YOUR-USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR-USERNAME/cap-table-tool.git
git branch -M main
git push -u origin main

# Deploy to GitHub Pages
npm run deploy
```

### Step 6: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** → **Pages**
3. Under "Source", select the `gh-pages` branch
4. Click **Save**
5. Your site will be live at: `https://YOUR-USERNAME.github.io/cap-table-tool`

### Updating Your Site

Whenever you make changes:

```bash
git add .
git commit -m "Description of changes"
git push origin main
npm run deploy
```

The `npm run deploy` command automatically builds and pushes to the `gh-pages` branch.

## Using the Tool

### Basic Workflow

1. **Set Founding Shares**: Enter the initial number of shares (default: 1,000,000)

2. **Add Funding Rounds**: Click "Add Round" and enter:
   - Round name (Pre-Seed, Seed, Series A, etc.)
   - Investment amount
   - Pre-money valuation
   - Option pool parameters
   - Liquidation preferences
   - Anti-dilution protection

3. **Analyze Ownership**: View charts showing:
   - How ownership evolves across rounds
   - Share price appreciation
   - Valuation growth

4. **Model Exit Scenarios**: Enter an exit valuation to see:
   - Step-by-step liquidation waterfall
   - Final proceeds for each shareholder
   - Return multiples

### Key Concepts Illustrated

**Pre-Money vs. Post-Money Option Pools**
- Pre-money pools dilute existing shareholders before new investment
- Post-money pools dilute everyone including new investors
- Experiment with both to see the dilution difference

**Liquidation Preferences**
- 1x preference: Investor gets their money back first
- Participating: Investor gets preference + pro-rata share of remainder
- Non-participating: Investor chooses preference OR pro-rata share (whichever is higher)

**Anti-Dilution Protection**
- Full Ratchet: Re-prices all previous shares at new lower price
- Weighted Average: Balanced protection based on amount raised
- Protects investors in down rounds (lower valuation than previous round)

## Educational Applications

This tool is designed for:

- **MBA Entrepreneurial Finance Courses**: Teach dilution mechanics and term sheet analysis
- **Founders**: Model different funding scenarios before negotiating terms
- **Investors**: Understand how different terms affect returns
- **Startup Teams**: Align on equity structure and exit expectations

### Sample Scenarios to Explore

1. **The Participating Preferred Effect**: Create two identical cap tables, one with participating and one without. Set exit at 2x total invested capital. Compare founder returns.

2. **Pre vs. Post Money Pools**: Add a 20% option pool pre-money vs. post-money in Series A. Compare founder dilution.

3. **Down Round Protection**: Create Series A at $10M, then Series B at $8M (down round). Toggle anti-dilution protection on/off to see the impact.

4. **Exit Value Sensitivity**: Model several rounds, then try exit values from 0.5x to 10x total capital raised. Find the "preference overhang" point.

## Technical Details

**Built With:**
- React 18
- Recharts (data visualization)
- Tailwind CSS (styling)
- Lucide React (icons)

**Browser Support:**
- Chrome (recommended)
- Firefox
- Safari
- Edge

## License

This tool is provided for educational purposes. Feel free to use, modify, and distribute for academic and non-commercial use.

## Contributing

Contributions are welcome! To contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/improvement`)
3. Commit your changes (`git commit -am 'Add new feature'`)
4. Push to the branch (`git push origin feature/improvement`)
5. Create a Pull Request

## Contact

For questions, suggestions, or course integration support:
- Professor Dimo - University of Bath
- Course: V-733-ENTR Entrepreneurial Finance

## Acknowledgments

Built as an educational tool for the MBA Entrepreneurial Finance course at University of Bath. Based on the DuPont framework organizing principle with four interconnected pillars: Opportunity (Revenue Model), Scalability (Cash Model), Execution (Cost Model), and Return (Investment Model).
