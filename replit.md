# YouTube to MP3 Converter

## Overview

This is a full-stack web application that converts YouTube videos to MP3 files. It features a React frontend with TypeScript, an Express.js backend, and uses PostgreSQL with Drizzle ORM for data management. The application supports both single and bulk conversions with real-time progress tracking.

## System Architecture

The application follows a clean separation between frontend and backend with shared types:

- **Frontend**: React with TypeScript, Vite for bundling, TailwindCSS + shadcn/ui for styling
- **Backend**: Express.js with TypeScript, handles API routes and video processing
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Shared**: Common TypeScript types and schemas between frontend and backend

## Key Components

### Frontend Architecture
- **React 18** with TypeScript for type safety
- **Vite** as the build tool and development server
- **TanStack Query** for server state management and API caching
- **Wouter** for lightweight client-side routing
- **shadcn/ui** component library built on Radix UI primitives
- **TailwindCSS** for utility-first styling

### Backend Architecture
- **Express.js** server with TypeScript
- **ytdl-core** for YouTube video information extraction
- **fluent-ffmpeg** for audio conversion processing
- **Archiver** for creating downloadable ZIP files for bulk conversions
- **File system management** for storing converted MP3 files

### Database Schema
- **Users table**: Basic user management with username/password
- **Conversions table**: Tracks conversion jobs with status, progress, file paths, and metadata
- **Drizzle ORM**: Provides type-safe database queries and schema management

### API Structure
- `GET /api/conversions` - Fetch all conversion jobs
- `POST /api/conversions` - Create single conversion job
- `POST /api/conversions/bulk` - Create multiple conversion jobs
- `GET /api/conversions/:id/download` - Download converted MP3 file
- `POST /api/conversions/download-selected` - Download multiple files as ZIP
- `DELETE /api/conversions/:id` - Delete conversion job

## Data Flow

1. **User Input**: Users paste YouTube URLs into the frontend interface
2. **Validation**: URLs are validated on both client and server sides
3. **Job Creation**: Conversion jobs are created in the database with "pending" status
4. **Processing**: Background processing extracts audio using ytdl-core and converts to MP3 with ffmpeg
5. **Progress Updates**: Real-time progress tracking via polling (2-second intervals)
6. **File Storage**: Converted files are stored in the `/downloads` directory
7. **Download**: Users can download individual files or bulk ZIP archives

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL database adapter
- **ytdl-core**: YouTube video downloading and metadata extraction
- **fluent-ffmpeg**: Audio/video processing and conversion
- **archiver**: ZIP file creation for bulk downloads

### UI Dependencies
- **@radix-ui**: Accessible component primitives
- **@tanstack/react-query**: Server state management
- **clsx & tailwind-merge**: Conditional CSS class utilities
- **lucide-react**: Icon library

### Development Dependencies
- **tsx**: TypeScript execution for development
- **esbuild**: Fast JavaScript bundler for production builds
- **drizzle-kit**: Database schema management and migrations

## Deployment Strategy

### Development
- Uses Vite dev server with hot module replacement
- Express server runs with tsx for TypeScript execution
- Parallel development workflow configured in `.replit`

### Production Build
- Frontend: Vite builds optimized React bundle to `dist/public`
- Backend: esbuild bundles Express server to `dist/index.js`
- Static files served by Express in production mode

### Environment Configuration
- Requires `DATABASE_URL` environment variable for PostgreSQL connection
- Optional `FFMPEG_PATH` for custom ffmpeg binary location
- Runs on port 5000 with external port 80 mapping

### Replit Configuration
- Auto-scaling deployment target
- PostgreSQL 16 module enabled
- Node.js 20 runtime environment

## User Preferences

Preferred communication style: Simple, everyday language.

## Changelog

Changelog:
- June 17, 2025. Initial setup