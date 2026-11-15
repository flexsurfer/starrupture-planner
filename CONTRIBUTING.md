# 🤝 Contributing to Rupture Planner

Thank you for your interest in contributing to Rupture Planner! This document provides guidelines and information for contributors.

## 🎯 Ways to Contribute

### 🐛 Bug Reports
- Use the [issue template](https://github.com/flexsurfer/starrupture-planner/issues/new) 
- Include clear steps to reproduce
- Provide screenshots if relevant
- Mention your browser/OS

### 💡 Feature Requests
- Check [existing issues](https://github.com/flexsurfer/starrupture-planner/issues) first
- Describe the use case and benefit
- Keep scope manageable
- Be open to discussion and iteration

### 🛠 Code Contributions
- Fork the repository
- Create a feature branch: `git checkout -b feature/amazing-feature`
- Follow our coding standards
- Add tests for new functionality
- Update documentation as needed

### 📚 Documentation
- Fix typos and improve clarity
- Add examples and use cases
- Translate to other languages
- Update outdated information

### 🎨 Game Data
- Add new items, buildings, or recipes
- Update existing data when the game changes
- Include proper icon files
- Verify accuracy in-game

## 🚀 Development Setup

### Prerequisites
- Node.js 18+
- npm or yarn
- Git

### Getting Started
```bash
# Clone your fork
git clone https://github.com/flexsurfer/starrupture-planner.git
cd starrupture-planner

# Install dependencies
npm install

# Start development server
npm run dev
```

### Available Scripts
```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run preview    # Preview production build
npm run test       # Run tests
npm run test:ui    # Run tests with UI
npm run lint       # Lint code
```

## 📋 Code Standards

### TypeScript
- Use strict TypeScript settings
- Define proper interfaces and types
- Avoid `any` types when possible
- Use meaningful variable names

### React
- Use functional components with hooks
- Follow React best practices
- Use proper key props for lists
- Handle loading and error states

### Styling
- Use Tailwind CSS classes
- Leverage DaisyUI components
- Follow responsive design principles
- Maintain consistent spacing

### Testing
- Write tests for new features
- Test edge cases and error conditions
- Use descriptive test names
- Mock external dependencies

## 📁 Project Structure

```
src/
├── components/          # React components
│   ├── planner/        # Production planner specific
│   ├── ui/             # Reusable UI components
│   ├── ItemsPage.tsx   # Items catalog page
│   ├── RecipesPage.tsx # Recipes browser page
│   └── TabLayout.tsx   # Main layout component
└── state/              # Reflex state management
    ├── db.ts          # Data models and store
    ├── events.ts      # State events
    ├── effects.ts     # Side effects
    └── subs.ts        # Subscriptions
```

The top-level `assets/` directory holds public static assets. Versioned game data lives
in the top-level `game-data/<version>/` directories and is imported as URLs with content hashes.

## 🎮 Game Data Format

### Items (`items_catalog.json`)
```json
{
  "id": "item_id",
  "name": "Display Name",
  "type": "raw|processed|component|ammo|final"
}
```

### Buildings (`buildings_and_recipes.json`)
```json
{
  "id": "building_id",
  "name": "Building Name",
  "recipes": [
    {
      "output": {
        "id": "item_id",
        "amount_per_minute": 60
      },
      "inputs": [
        {
          "id": "input_item_id",
          "amount_per_minute": 90
        }
      ]
    }
  ]
}
```

## 📝 Commit Guidelines

### Commit Message Format
```
type(scope): description

[optional body]

[optional footer]
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting changes
- `refactor`: Code restructuring
- `test`: Test additions/changes
- `chore`: Build process, dependencies

### Examples
```
feat(planner): add production rate calculator
fix(ui): resolve mobile layout issues
docs(readme): update installation instructions
```

## 🔍 Pull Request Process

1. **Fork & Branch**: Create a feature branch from `main`
2. **Develop**: Make your changes following our guidelines
3. **Test**: Ensure all tests pass and add new ones
4. **Document**: Update docs if needed
5. **Commit**: Use clear, descriptive commit messages
6. **Push**: Push to your fork
7. **PR**: Create a pull request with:
   - Clear title and description
   - Reference any related issues
   - Screenshots for UI changes
   - Testing notes

### PR Review Criteria
- ✅ Code follows style guidelines
- ✅ Tests pass and coverage is maintained
- ✅ Documentation is updated
- ✅ No breaking changes (or properly documented)
- ✅ Performance considerations addressed

## 🌟 Recognition

Contributors are recognized in:
- GitHub contributors list
- Release notes for significant contributions
- Special mentions for major features

---

**Remember: This is a fun project made by gamers, for gamers! Keep the spirit positive and collaborative.** 🎮✨