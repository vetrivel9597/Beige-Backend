# NEWME

The storefront runs as a React single page app in the sibling `Beauty-care-frontend/` directory. Each storefront route has its own React page component under `Beauty-care-frontend/src/pages`, with shared layout and product components in `Beauty-care-frontend/src/components`.

The Node/Express backend retains the API routes, database models and queries, authentication, sessions, file uploads, and payment processing. EJS templates and the Express view engine have been removed. Frontend images and media live in `client/public/Assets`; backend-generated invoices remain in `public/Assets/invoices`.

## Run locally

1. Install backend dependencies with `npm install` and frontend dependencies with `npm --prefix ../Beauty-care-frontend install`.
2. Run `npm start` to build React and start Express on port 3000.
3. For frontend development, run `npm --prefix ../Beauty-care-frontend start` in another terminal. The React dev server proxies backend requests to port 3000.
# Beige-Backend
