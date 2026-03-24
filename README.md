# Rupture Planner

<div align="center">

   <img src="./assets/logo_black_bg.webp" width="100" />


**The Ultimate Production Planning Tool for Star Rupture**

*Plan, optimize, and have fun with perfect resource management!* 🌌

[![Built with React](https://img.shields.io/badge/React-19.1.0-blue?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-7.0.4-646CFF?logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.1.11-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)

[🎮 Open Planner](https://www.starrupture-planner.com) • [🛠 Contribute](https://github.com/flexsurfer/starrupture-planner/blob/main/CONTRIBUTING.md)

</div>

---

## ✨ What is Rupture Planner?

Rupture Planner is a **free, open-source production planning tool** designed for the Star Rupture game. Whether you're a casual builder or a min-maxing efficiency expert, this tool helps you:

- 🏭 **Visualize complex production chains** with interactive flow diagrams
- 📊 **Calculate exact building requirements** for any production target
- 🎯 **Optimize resource allocation** and eliminate bottlenecks
- 🔍 **Browse all items and recipes** with advanced filtering
- 🌙 **Work in comfort** with beautiful light/dark themes

*Built by gamers, for gamers - just for the fun of it!* 🎉

---

## 🌟 Features

### 📦 **Smart Item Catalog**
- Browse all game items with beautiful icons
- Filter by type: Raw Materials, Processed, Components, Ammo
- Color-coded categories for instant recognition
- Responsive grid layout that adapts to your screen

### ⚗️ **Interactive Recipe Browser**
- Collapsible building sections (closed by default for clean browsing)
- Visual input/output relationships with item icons
- Production rates clearly displayed for each recipe
- Hover effects and smooth animations

### 🏭 **Advanced Production Planner**
- **Interactive Flow Diagrams**: See your entire production chain at a glance
- **Smart Auto-Layout**: Uses Dagre algorithm for optimal node positioning
- **Visual Production Flow**: Item icons on edges show what flows where
- **Building Count Calculator**: Automatically calculates exact requirements
- **Lazy Loading**: Optimized bundle splitting for fast initial load
- **Auto-Fit View**: Automatically centers and scales diagrams when switching items
- **Zoom & Pan**: Full navigation controls with minimap

### 🎨 **Beautiful User Experience**
- Modern, responsive design with Tailwind CSS + DaisyUI
- Smooth animations and transitions
- Light/Dark theme toggle
- Intuitive tab-based navigation

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ 
- **npm** or **yarn**

### Installation

```bash
# Clone the repository
git clone https://github.com/flexsurfer/starrupture-planner.git
cd starrupture-planner

# Install dependencies
npm install

# Start development server
npm run dev
```

🎉 **That's it!** Open `http://localhost:5173` and start planning your galactic empire!

### Build for Production

```bash
# Create optimized build
npm run build

# Preview production build
npm run preview
```

---

## 🛠 Tech Stack

This project uses modern, cutting-edge technologies:

| Technology | Purpose | Version |
|------------|---------|---------|
| **⚛️ React** | UI Framework | 19.1.0 |
| **📘 TypeScript** | Type Safety | 5.8.3 |
| **⚡ Vite** | Build Tool | 7.0.4 |
| **🎨 Tailwind CSS** | Styling | 4.1.11 |
| **🌸 DaisyUI** | UI Components | 5.0.50 |
| **🔄 React Flow** | Interactive Diagrams | 12.8.2 |
| **📊 Dagre** | Graph Layout | 0.8.5 |
| **🔥 Reflex** | State Management | 0.1.12 |
| **🧪 Vitest** | Testing | 3.2.4 |

---

## 📁 Project Structure

```
starrupture-planner/
├── 📄 README.md           # You are here!
├── 🎨 assets/             # Static assets (images, icons)
│   └── icons/
│       ├── buildings/     # Building icons
│       └── items/         # Item icons
├── 🏗️ src/
│   ├── components/        # React components
│   │   ├── planner/       # Production planner logic
│   │   └── ui/           # Reusable UI components
│   ├── state/            # Reflex state management
│   └── data/             # Game data (JSON)
├── 📦 dist/              # Production build
└── ⚙️ config files       # Vite, TypeScript, ESLint
```

---

## 🎮 How to Use

### 1. **Browse Items** 📦
- Click the **Items** tab to explore all game items
- Use category filters to find what you need
- Each item shows its type with color coding

### 2. **Explore Recipes** ⚗️
- Visit the **Recipes** tab to see all production recipes
- Click on any building header to expand/collapse its recipes
- Visual flow shows inputs → building → outputs

### 3. **Plan Production** 🏭
- Go to the **Planner** tab for advanced planning
- Select any item from the dropdown
- Set your target production rate
- Watch the magic happen! ✨

The planner will:
- Calculate exact building counts needed
- Show the complete supply chain
- Display item flow rates between buildings
- Auto-arrange everything in a clean diagram

---

## 🤝 Contributing

We love contributors! Whether you're fixing bugs, adding features, or improving docs, every contribution makes Rupture Planner better.

### 🐛 Found a Bug?
1. Check [existing issues](https://github.com/flexsurfer/starrupture-planner/issues)
2. Create a new issue with:
   - Clear description
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots if applicable

### 💡 Have an Idea?
1. Open an issue to discuss your idea
2. We'll help you shape it into an actionable plan
3. Fork, code, and submit a PR!

### 🛠 Development Workflow

```bash
# 1. Fork and clone
git clone https://github.com/flexsurfer/starrupture-planner.git
cd starrupture-planner

# 2. Create feature branch
git checkout -b feature/awesome-feature

# 3. Install and start
npm install
npm run dev

# 4. Code your magic ✨
# ... make your changes ...

# 5. Test everything
npm run test
npm run lint

# 6. Commit and push
git commit -m "Add awesome feature"
git push origin feature/awesome-feature

# 7. Create Pull Request
```

### 📋 Contribution Guidelines

- **Code Style**: We use ESLint + Prettier (runs automatically)
- **Testing**: Add tests for new features
- **Documentation**: Update README if needed
- **Small PRs**: Keep changes focused and reviewable
- **Have Fun**: This is a fun project - enjoy the process! 🎉

### 🎨 Adding New Game Data

Game data lives in `src/data/`:
- `items_catalog.json` - All game items
- `buildings_and_recipes.json` - Buildings and their recipes

To add new items/buildings:
1. Update the JSON files
2. Add corresponding icon images to `assets/icons/`
3. Test in the app
4. Submit a PR!

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

**TL;DR**: Free to use, modify, and share. Just give credit where it's due! 🙏

---

## 🎯 Roadmap

Exciting features coming soon:

- [ ] 🔧 **Recipe Optimization**: Find the most efficient production setups
- [ ] 💾 **Save/Load Plans**: Bookmark your favorite production chains
- [ ] 🔍 **Advanced Search**: Find items by name, type, or usage
- [ ] 📊 **Resource Calculator**: Calculate total raw material needs
- [ ] 🌐 **Multiplayer Planning**: Share plans with your team
- [ ] 📱 **Mobile App**: Take your plans on the go
- [ ] 🎨 **Custom Themes**: Personalize your planning experience

---

## 🙋‍♀️ FAQ

**Q: Is this official?**  
A: Nope! This is a fan-made tool built for fun by the community.

**Q: Is it free?**  
A: 100% free, open-source, and always will be!

**Q: Can I contribute?**  
A: Absolutely! We welcome all skill levels.

**Q: Does it work on mobile?**  
A: It's responsive and works on mobile, but desktop is recommended for complex planning.

**Q: What if the game updates?**  
A: We'll update the data files to match. Community help is always welcome!

---

## 💖 Acknowledgments

- **Star Rupture** community for inspiration
- **React Flow** team for amazing diagram capabilities
- **Tailwind CSS** & **DaisyUI** for beautiful styling
- All contributors and users who make this project awesome!

---

<div align="center">

**Made with ❤️ by gamers, for gamers**

*May your production lines be efficient and your resources abundant!* 🌌

⭐ **Star this repo if it helped you!** ⭐

[🐛 Report Bug](https://github.com/flexsurfer/starrupture-planner/issues) • 
[💡 Request Feature](https://github.com/flexsurfer/starrupture-planner/issues) • 
[🤝 Contribute](https://github.com/flexsurfer/starrupture-planner/pulls)

</div>
