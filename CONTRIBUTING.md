# Contributing to WebDav-UI

First off, thanks for taking the time to contribute! 🎉

The following is a set of guidelines for contributing to WebDav-UI. These are just guidelines, not rules. Use your best judgment, and feel free to propose changes to this document in a pull request.

## Code of Conduct

This project and everyone participating in it is governed by a Code of Conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## How Can I Contribute?

### Reporting Bugs

This section guides you through submitting a bug report for WebDav-UI. Following these guidelines helps maintainers and the community understand your report, reproduce the behavior, and find related reports.

- **Use a clear and descriptive title** for the issue to identify the problem.
- **Describe the exact steps to reproduce the problem** in as many details as possible.
- **Provide specific examples** to demonstrate the steps.
- **Describe the behavior you observed after following the steps** and point out what exactly is the problem with that behavior.
- **Explain which behavior you expected to see instead and why.**
- **Include screenshots and animated GIFs** which show you following the described steps and clearly demonstrate the problem.

### Suggesting Enhancements

This section guides you through submitting an enhancement suggestion for WebDav-UI, including completely new features and minor improvements to existing functionality.

- **Use a clear and descriptive title** for the issue to identify the suggestion.
- **Provide a step-by-step description of the suggested enhancement** in as many details as possible.
- **Provide specific examples to demonstrate the steps**.
- **Describe the current behavior** and **explain which behavior you expected to see instead** and why.

### Pull Requests

The process described here has several goals:

- Maintain WebDav-UI's quality.
- Fix problems that are important to users.
- Engage the community in working toward the best possible WebDav-UI.
- Enable a sustainable system for WebDav-UI's maintainers to review contributions.

Please follow these steps to have your contribution considered by the maintainers:

1.  Follow all instructions in [the template](.github/PULL_REQUEST_TEMPLATE.md) (if available).
2.  Follow the [styleguides](#styleguides).
3.  After you submit your pull request, verify that all status checks are passing.

## Styleguides

### Git Commit Messages

- Use the present tense ("Add feature" not "Added feature").
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...").
- Limit the first line to 72 characters or less.
- Reference issues and pull requests liberally after the first line.

### JavaScript/TypeScript Styleguide

- All TypeScript code should be linted with ESLint.
- Use `const` and `let`, avoid `var`.
- Prefer strict equality `===`.
- Use async/await over promises where possible.
- Define types/interfaces for props and state.

## Setting up the development environment

1.  Clone the repository.
2.  Run `npm install` to install dependencies.
3.  Copy `example.env.local` to `.env.local` and configure your WebDAV credentials.
4.  Run `npm run dev` to start the development server.

See the [README](README.md) for more detailed instructions.

## Testing

Please ensure you run existing tests and add new tests for your changes if applicable.

```bash
npm test
```

Thank you for your contributions!
