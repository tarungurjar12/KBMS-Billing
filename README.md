# KBMS Billing Application

This repository contains the source code for the KBMS Billing application, a comprehensive solution designed to manage billing, invoicing, customer, and product data for building material supply businesses. It provides role-based access for Admins and Store Managers to streamline daily operations.

## Table of Contents

  - [Core Features](https://www.google.com/search?q=%23core-features)
  - [Roles & Permissions](https://www.google.com/search?q=%23roles--permissions)
  - [Technology Stack](https://www.google.com/search?q=%23technology-stack)
  - [Getting Started](https://www.google.com/search?q=%23getting-started)
      - [Installation](https://www.google.com/search?q=%23installation)
      - [Configuration](https://www.google.com/search?q=%23configuration)
      - [Running the Application](https://www.google.com/search?q=%23running-the-application)
  - [Project Structure](https://www.google.com/search?q=%23project-structure)
  - [Style Guidelines](https://www.google.com/search?q=%23style-guidelines)

## Core Features

The KBMS Billing application is built with the following core functionalities:

  - **Admin Dashboard**: A comprehensive interface providing an overview of key business metrics, user management tools, and system configurations.
  - **Customer Management**: Tools for managing customer profiles, sales history, and payment information.
  - **Billing & Invoicing**: An interface for creating and managing GST-compliant bills and invoices.
  - **Product Database**: Admin tools for managing product information, pricing rules, and inventory levels.
  - **Pricing Rules Engine**: Flexible pricing rules for automated tiered, bulk, and volume pricing based on admin configurations (note: actual application logic is a planned feature, currently stores descriptive text).
  - **Stock Availability View**: Real-time stock level display for Store Managers to inform customers.
  - **Payment Records**: An interface for manually tracking and managing payment status for both customer payments and supplier payments.
  - **Daily Ledger**: A module for recording daily sales, purchases, and payment postings. It also includes functionality to manage stock movements and link to payment records.

## Roles & Permissions

The application supports two primary user roles with distinct access levels:

  - **Admin**: Full access to all modules, including user management (Store Managers), product database, pricing rules, inventory adjustments, and all financial records.
  - **Store Manager**: Access to daily operational tasks such as creating bills, managing customers, viewing product and stock information (read-only with issue reporting), and interacting with the daily ledger.

Middleware (`src/middleware.ts`) is implemented to enforce role-based access control and manage authentication redirects.

## Technology Stack

The application is built using a modern JavaScript ecosystem:

  - **Frontend Framework**: Next.js 15.3.3 (React framework for building web applications)
  - **Styling**: Tailwind CSS 3.4.17 for utility-first CSS, configured via `tailwind.config.ts`.
  - **UI Components**: ShadCN UI, with components defined in `components.json` and used across the application.
  - **Database**: Google Firebase Firestore for real-time NoSQL database capabilities.
  - **Authentication**: Google Firebase Authentication for user management.
  - **AI Integration**: Genkit AI ([`@genkit-ai/googleai`](https://www.google.com/search?q=%5Bhttps://www.npmjs.com/package/%40genkit-ai/googleai%5D\(https://www.npmjs.com/package/%40genkit-ai/googleai\))) for potential AI features (e.g., content generation, smart suggestions), configured in `src/ai/genkit.ts`.
  - **Form Management**: React Hook Form with Zod for schema validation.
  - **PDF Generation**: `jspdf` and `html2canvas` for client-side PDF generation.
  - **Utility Libraries**: `clsx`, `tailwind-merge` for CSS class manipulation (`src/lib/utils.ts`), `date-fns` for date formatting.

## Getting Started

Follow these instructions to set up and run the project locally.

### Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/tarungurjar12/kbms-billing.git
    cd kbms-billing
    ```
2.  **Install dependencies**:
    ```bash
    npm install
    # or if you use yarn
    yarn install
    ```
    *Note*: The `package-lock.json` and `package.json` files detail all project dependencies.

### Configuration

The Firebase configuration is currently hardcoded in `src/lib/firebase/firebaseConfig.ts`. For a production environment, it is highly recommended to use environment variables.

### Running the Application

  - **Start the development server**:
    ```bash
    npm run dev
    # or
    yarn dev
    ```
    This will start the Next.js development server, usually on `http://localhost:9002`.
  - **Start Genkit development server**:
    ```bash
    npm run genkit:dev
    # or
    yarn genkit:dev
    ```
    This runs the Genkit server using `src/ai/dev.ts` (which imports `src/ai/genkit.ts`) for AI development purposes.
  - **Build for production**:
    ```bash
    npm run build
    # or
    yarn build
    ```
  - **Start production server**:
    ```bash
    npm start
    # or
    yarn start
    ```

## Project Structure

The project follows a standard Next.js directory structure:

```
.
├── README.md
├── firebase.json (Firebase project configuration)
├── next.config.js (Next.js configuration)
├── package.json (Project dependencies and scripts)
├── public (Static assets)
├── src
│   ├── ai
│   │   ├── dev.ts (Genkit development setup)
│   │   └── genkit.ts (Genkit configuration)
│   ├── app
│   │   ├── (main)
│   │   │   ├── billing
│   │   │   │   └── page.tsx (Billing & Invoicing page)
│   │   │   ├── create-bill
│   │   │   │   └── page.tsx (Create Bill/Invoice page)
│   │   │   ├── customers
│   │   │   │   └── page.tsx (Customer Management page)
│   │   │   ├── layout.tsx (Main app layout with auth)
│   │   │   ├── ledger
│   │   │   │   └── page.tsx (Daily Ledger page)
│   │   │   ├── managers
│   │   │   │   └── page.tsx (Manage Managers page)
│   │   │   ├── my-profile
│   │   │   │   └── page.tsx (My Profile page)
│   │   │   ├── page.tsx (Admin Dashboard)
│   │   │   ├── payments
│   │   │   │   └── page.tsx (Payment Records page)
│   │   │   ├── pricing-rules
│   │   │   │   └── page.tsx (Pricing Rules page)
│   │   │   ├── products
│   │   │   │   └── page.tsx (Product Database page)
│   │   │   ├── sellers
│   │   │   │   └── page.tsx (Manage Sellers page)
│   │   │   ├── stock
│   │   │   │   └── page.tsx (Inventory Levels page)
│   │   │   ├── store-dashboard
│   │   │   │   └── page.tsx (Store Manager Dashboard)
│   │   │   └── view-products-stock
│   │   │       └── page.tsx (View Products & Stock page for managers)
│   │   ├── globals.css (Global Tailwind CSS styles and custom properties)
│   │   ├── layout.tsx (Root HTML layout)
│   │   ├── login
│   │   │   └── page.tsx (Login page)
│   │   └── register-admin
│   │       └── page.tsx (Admin Registration page)
│   ├── components
│   │   ├── invoice
│   │   │   └── invoice-template.tsx (Invoice PDF template)
│   │   ├── layout
│   │   │   └── sidebar-nav.tsx (Sidebar Navigation)
│   │   ├── page-header.tsx (Reusable Page Header component)
│   │   └── ui (ShadCN UI components)
│   │       ├── accordion.tsx
│   │       ├── alert-dialog.tsx
│   │       ├── alert.tsx
│   │       ├── avatar.tsx
│   │       ├── badge.tsx
│   │       ├── button.tsx
│   │       ├── calendar.tsx
│   │       ├── card.tsx
│   │       ├── chart.tsx
│   │       ├── checkbox.tsx
│   │       ├── dialog.tsx
│   │       ├── dropdown-menu.tsx
│   │       ├── form.tsx
│   │       ├── input.tsx
│   │       ├── label.tsx
│   │       ├── menubar.tsx
│   │       ├── popover.tsx
│   │       ├── progress.tsx
│   │       ├── radio-group.tsx
│   │       ├── scroll-area.tsx
│   │       ├── select.tsx
│   │       ├── separator.tsx
│   │       ├── sheet.tsx
│   │       ├── sidebar.tsx
│   │       ├── skeleton.tsx
│   │       ├── slider.tsx
│   │       ├── switch.tsx
│   │       ├── table.tsx
│   │       ├── tabs.tsx
│   │       ├── textarea.tsx
│   │       ├── toast.tsx
│   │       ├── toaster.tsx
│   │       └── tooltip.tsx
│   ├── hooks
│   │   ├── use-mobile.tsx (Custom hook for mobile detection)
│   │   └── use-toast.ts (Custom hook for toast notifications)
│   ├── lib
│   │   ├── firebase
│   │   │   └── firebaseConfig.ts (Firebase initialization)
│   │   └── utils.ts (Utility functions for Tailwind CSS)
│   └── middleware.ts (Next.js middleware for authentication and routing)
├── tailwind.config.ts (Tailwind CSS configuration)
└── tsconfig.json (TypeScript configuration)
```

## Style Guidelines

The application adheres to a clean and intuitive design, as per its blueprint:

  - **Primary Color**: Soft blue (`#64B5F6`) to inspire confidence and reliability in financial transactions.
  - **Background Color**: Light gray (`#F0F4F8`) for a clean and neutral backdrop, ensuring readability and focus.
  - **Accent Color**: Subtle green (`#81C784`) for key actions and success states, adding a touch of reassurance.
  - **Fonts**: 'Inter' (sans-serif) for both body and headlines, providing a modern and neutral feel.
  - **Layout**: Clean and intuitive grid-based layout for easy navigation.
  - **Icons**: Minimalist icons represent various functionalities within the system.
  - **Animations**: Subtle animations enhance user experience and guide interactions, such as loading indicators or form feedback.

These styles are primarily implemented using Tailwind CSS, configured through `src/app/globals.css` and `tailwind.config.ts`.