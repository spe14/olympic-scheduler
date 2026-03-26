// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://c55b239f49088e5e299a9580da17a89d@o4511111434600448.ingest.us.sentry.io/4511111436042240",

  sendDefaultPii: false,
});
