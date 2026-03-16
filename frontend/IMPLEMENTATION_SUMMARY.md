# TeXPress - LaTeX Editor Implementation Summary

## Overview
A sleek, modern, minimal LaTeX editor inspired by Apple's UI/UX principles, designed for creating professional resumes with a focus on smooth performance and liquid interactions.

## Architecture & Key Components

### State Management
- **Zustand Store** (`lib/store.ts`): Centralized global state management with persistence
  - File operations (rename, delete, create)
  - Editor state (content, modified, building)
  - UI state (sidebar width, modals, panels)
  - Settings (font size, tab size, compiler, color palette)
  - Recent files and build logs
  - Auto-saved to localStorage

### Color System
- **5 Distinct Color Palettes**: Monochrome, Blue, Emerald, Warm, Minimal
- **Light/Dark Mode Support**: Each palette has coherent light and dark variants
- **CSS Variables**: All colors defined in `globals.css` using OKLch color space
- **Dynamic Switching**: Real-time theme changes via `color-palette-context.tsx`

### Core Components

#### Header (`components/editor/header.tsx`)
- Memoized for performance
- File/Edit/Insert dropdown menus with actual functionality
- Theme selector preventing hydration mismatches
- Project name and modification indicator
- Build button with loading state

#### File Explorer (`components/editor/file-tree.tsx`)
- Tree view with expand/collapse functionality
- Context menu (right-click) for file operations
- Inline rename with Enter/Escape keyboard support
- Create file/folder within any directory
- Delete files with single click
- Indicator for main file and folder states

#### Code Editor (`components/editor/smooth-code-editor.tsx`)
- Custom textarea-based editor for smooth performance
- Tab key support with configurable tab size
- Line numbers with synchronized scrolling
- Real-time character/line count
- Keyboard shortcuts (Cmd+S for save, Cmd+B for build)
- No lag - optimized for fast typing response

#### PDF Preview (`components/editor/pdf-preview.tsx`)
- Zoom controls (25% to 200%)
- Simulated resume preview with actual LaTeX content rendering
- Build status indicator with spinning loader
- Download button ready for future PDF export

#### Build Log (`components/editor/build-log.tsx`)
- Real-time compilation status and messages
- Color-coded icons for error/warning/success/info
- Clickable entries to jump to error lines
- Summary statistics (error and warning counts)
- Dismissible panel

#### Settings Panel (`components/editor/advanced-settings.tsx`)
- **5 Color Palette Selection**: Visual swatches with light/dark preview
- **Editor Settings**: Font size (12-20px), tab size (2-8 spaces), word wrap toggle
- **Compiler Selection**: pdfLaTeX, XeTeX, LuaTeX
- **Build Options**: Auto-save, build-on-save toggles
- Changes persist across sessions

#### Template Modal (`components/editor/template-modal.tsx`)
- 5 professional resume templates
- Visual selection with icon indicators
- Minimal, Professional, Modern, Academic, Creative styles
- Ready for template content loading

### UI/UX Features

#### Smooth Interactions
- Memoized components prevent unnecessary re-renders
- Debounced scroll events
- CSS transitions for theme changes (0.2s)
- Hardware-accelerated transforms for zoom

#### Keyboard Shortcuts
- `Cmd/Ctrl + S`: Save file
- `Cmd/Ctrl + B`: Build/Compile
- `Tab`: Insert indentation
- `Enter`: Rename (in rename mode)
- `Escape`: Cancel rename

#### Accessibility
- ARIA labels and semantic HTML
- Screen reader-only text where needed
- Keyboard-navigable menus
- High contrast color pairs

## File Operations

### Rename
- Right-click file → Edit
- Type new name
- Press Enter to confirm or Escape to cancel
- Updates in tree immediately
- Updates store state

### Delete
- Right-click file → Delete
- Removes from tree and store
- Parent folders preserved
- Current file cleared if deleted

### Create
- Right-click folder → New File/Folder
- Auto-creates with "untitled.tex" or "New Folder" name
- Ready for immediate rename
- Appears in tree instantly

## Performance Optimizations

1. **Memoization**: All main components wrapped with `memo()`
2. **Zustand**: Efficient state updates without re-rendering entire tree
3. **CSS Variables**: Fast theme switching without DOM mutations
4. **Scrollbar Styling**: Custom thin scrollbars (-webkit) with opacity transitions
5. **Hardware Acceleration**: Transform-based zoom in preview
6. **No Hydration Mismatches**: Proper use of `suppressHydrationWarning` and mounted state

## Styling System

### Design Tokens (`globals.css`)
- **Background & Foreground**: Primary text and background colors
- **Card & Popover**: Container styling
- **Primary/Secondary**: Action button colors
- **Muted**: Disabled/secondary text
- **Accent**: Highlight and active states
- **Border & Input**: Form and structural elements
- **Editor**: Code editor specific colors (bg, gutter, cursor, selection)
- **Syntax**: LaTeX syntax highlighting colors
- **Status**: Success, warning, error colors

### Theme Classes
- `:root` - Light mode defaults (currently all palettes)
- `.dark` - Dark mode overrides
- `[data-color-palette="blue"]` - Blue palette
- `[data-color-palette="emerald"]` - Emerald palette
- `[data-color-palette="warm"]` - Warm palette
- `[data-color-palette="minimal"]` - Minimal grayscale palette

## Recent Fixes

### Hydration Mismatch Resolution
- **Issue**: Theme icon rendered differently on server vs client
- **Solution**: 
  - Memoized ThemeSelector as separate component
  - Used `suppressHydrationWarning` on html element
  - Mounted state properly handled in layout
  - Each theme option rendered consistently

### Editor Lag Fix
- **Issue**: Custom highlight code was causing re-renders
- **Solution**: 
  - Switched to optimized textarea implementation
  - Removed complex DOM manipulation
  - Efficient scroll synchronization
  - Memoized line number rendering

## Dependencies

### Core
- `next@16.1.6`: React framework with App Router
- `react@19.2.4`: UI library
- `tailwindcss@^4.2.0`: Utility-first CSS
- `next-themes@^0.4.6`: Dark mode management

### State & Data
- `zustand@^4.4.7`: State management with persistence
- `zod@^3.24.1`: Schema validation

### UI Components
- `@radix-ui/*`: Accessible component primitives
- `lucide-react`: Icon library
- `recharts`: Chart library (for future analytics)

### Utilities
- `class-variance-authority`: Component variant system
- `clsx/tailwind-merge`: Class name utilities

## Future Enhancements

1. **WASM LaTeX Compiler**: Integrate SwiftLaTeX or similar for offline compilation
2. **File System API**: Use native File System Access API for real folder access
3. **Snippets**: LaTeX command snippets for common resume structures
4. **Multi-file Compilation**: Proper include/input handling
5. **Git Integration**: Save projects to GitHub repositories
6. **Collaborative Editing**: Real-time collaboration support
7. **Export Options**: PDF, HTML, Word export formats
8. **Cloud Sync**: Save to cloud storage (Google Drive, Dropbox)

## How to Run

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build
```

The app will be available at http://localhost:3000 with dark mode enabled by default. Use the theme selector in the header to switch color palettes or light/dark modes.

## Code Quality

- **No Hydration Warnings**: Proper server/client separation
- **No Prop Drilling**: Zustand handles global state
- **Memoized Components**: Prevents unnecessary re-renders
- **Semantic HTML**: Proper accessibility structure
- **Type Safety**: Full TypeScript with proper interfaces
- **Clean Separation**: Editor logic isolated from UI
