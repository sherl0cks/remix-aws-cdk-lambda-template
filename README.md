# Welcome to Remix on AWS Serverless & CDK!

This template does 3 things:
1. Copies in the remix basic template for local development.
2. Copies the remix architect server adapter for AWS lambda.
3. Deploys the build output to API Gateway, Lambda and S3 using the AWS CDK.

The idea is to keep as much out of the box remix magic as possible, but integrat

- [Remix Docs](https://remix.run/docs)

## Development

From your terminal:

```sh
npm run dev
```

This starts your app in development mode, rebuilding assets on file changes.

## Deployment

First, build your app for production:

```sh
npm run build
```

Then run the app in production mode:

```sh
npm start
```

Now you'll need to pick a host to deploy it to.

