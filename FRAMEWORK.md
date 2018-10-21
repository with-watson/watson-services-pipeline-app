# WithWatson Development Framework

A Development Scaffholding based on a set of JavaScript frameworks.

## Frameworks

This Scaffholding is based on the following popular frameworks with an IBM Watson twist.

- Loopback v3.x
- Angular v6.x
- Bootstrap v4.x

## What this scaffholding includes

### Loopback

- Loopback Authentication is enabled and a set of users will be created automatically when the server starts.  `server/boot/init-api-users.js`
- Server contains a preconfigured Winston logger that can be required in any of your modules. `server/utils/logger.js`
- Full featured environment configuration to define credentials and other variables to use at runtime.  See Configuration for more details.
- A set of Loopback Components that can be added to the `component-config.json` file to enable proxy api's to Watson Services.
- Loopback is configured to serve the Angular application

### Angular

- Authentication module is pre-defined to log into Loopback and maintain the access token.
- A set of functions in the auth-service that will allow you to make authenticated calls to loopback.
- Basic application structure is predefined with Routes setup and ready to go.
- Bootstrap 4 is pre-configured and customizable in the styles.scss file.

### Bootstrap

- Bootstrap has been integrated into the Sass build process of Angular.  This means that you can customize Bootstrap in the styles.scss file.
- IBM Plex fonts has also been installed and Bootstrap is configured to use these fonts.