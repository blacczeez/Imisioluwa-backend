# E-commerce Backend API

Node.js/Express backend API for the local e-commerce platform.

## Features

- RESTful API
- PostgreSQL database with Prisma ORM
- JWT authentication (required for admin, optional for customers)
- Guest checkout support
- Payment integration (Paystack)
- File upload for product images
- Email notifications
- Bilingual support (English/Yoruba)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file from `.env.example`:
```bash
cp .env.example .env
```

3. Update environment variables in `.env`

4. Set up PostgreSQL database

5. Run Prisma migrations:
```bash
npm run prisma:migrate
```

6. Generate Prisma client:
```bash
npm run prisma:generate
```

7. Start development server:
```bash
npm run dev
```

## API Endpoints

### Public Endpoints (No Auth Required)
- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get product by ID
- `GET /api/categories` - Get all categories
- `POST /api/orders` - Create order (guest checkout)
- `GET /api/orders/track` - Track order by order number + phone
- `POST /api/payments/initialize` - Initialize payment
- `POST /api/payments/verify` - Verify payment (webhook)

### Admin Endpoints (Auth Required)
- `POST /api/admin/products` - Create product
- `PUT /api/admin/products/:id` - Update product
- `DELETE /api/admin/products/:id` - Delete product
- `POST /api/admin/products/:id/images` - Upload product images
- `GET /api/admin/orders` - Get all orders
- `PUT /api/admin/orders/:id/status` - Update order status
- `GET /api/admin/dashboard/stats` - Dashboard statistics
- `GET /api/admin/dashboard/analytics` - Analytics data
- `GET /api/admin/inventory` - Inventory status
- `GET /api/admin/customers` - Get all customers

## Technologies

- Node.js with Express
- TypeScript
- PostgreSQL
- Prisma ORM
- JWT for authentication
- Bcrypt for password hashing
- Multer for file uploads
- Nodemailer for emails
- Paystack for payments
