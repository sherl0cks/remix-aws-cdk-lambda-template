/**
 * A slightly different remix build config is required for the local remix-serve config vs the one that is needed to
 * deploy to AWS. Instead of using complicated tools to reproduce AWS locally, we just check for an environment variable
 * and conditionally apply the different configs.
 *
 * remix dev uses process.env.NODE_ENV === "development"
 * remix build uses process.env.NODE_ENV === "production"
 */


/** @type {import('@remix-run/dev').AppConfig} */
const localRemixServeConfig = {
  ignoredRouteFiles: ["**/.*"],
}

/** @type {import('@remix-run/dev').AppConfig} */
const awsServerlessConfig =  {
  ignoredRouteFiles: ["**/.*"],
  publicPath: "/_static/build/",
  server: "server.ts",
}

const config = process.env?.NODE_ENV === "production" ? awsServerlessConfig : localRemixServeConfig

export default config