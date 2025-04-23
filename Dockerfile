FROM mcr.microsoft.com/playwright:v1.49.1-noble

# Define and expose build-time args as env vars
ARG NPM_ARTIFACT
ENV NPM_ARTIFACT=${NPM_ARTIFACT}
ARG RELEASE_VERSION
ENV RELEASE_VERSION=${RELEASE_VERSION}
ARG version
ENV version=${version}
ARG MANUAL_SNAPSHOT
ENV MANUAL_SNAPSHOT=${MANUAL_SNAPSHOT}
ARG IS_BATCH
ENV IS_BATCH=${IS_BATCH}
ARG BATCH_NUMBER
ENV BATCH_NUMBER=${BATCH_NUMBER}
ARG TEST_USERNAME
ENV TEST_USERNAME=${TEST_USERNAME}
ARG TEST_PASSWORD
ENV TEST_PASSWORD=${TEST_PASSWORD}
ARG IS_PR
ENV IS_PR=${IS_PR}
ARG BUILD_CAUSE
ENV BUILD_CAUSE=${BUILD_CAUSE}
ARG COMMIT_AUTHOR
ENV COMMIT_AUTHOR=${COMMIT_AUTHOR}
ARG COMMIT_EMAIL
ENV COMMIT_EMAIL=${COMMIT_EMAIL}
ARG COMMIT_MESSAGE
ENV COMMIT_MESSAGE=${COMMIT_MESSAGE}
ARG UPSTREAM_BRANCH
ENV UPSTREAM_BRANCH=${UPSTREAM_BRANCH}
ARG BUILD_NUMBER_UP
ENV BUILD_NUMBER_UP=${BUILD_NUMBER_UP}
ARG BUILD_NUMBER_DOWN
ENV BUILD_NUMBER_DOWN=${BUILD_NUMBER_DOWN}
ARG TEAMS_WEBHOOK_URL
ENV TEAMS_WEBHOOK_URL=${TEAMS_WEBHOOK_URL}
ARG BUILD_URL
ENV BUILD_URL=${BUILD_URL}

# Setup workspace
WORKDIR /srv
RUN mkdir -p /srv/test-results && chmod -R 777 /srv/test-results

# Copy essential files
COPY package.json ./
COPY pnpm-lock.yaml ./
COPY pom.xml ./
COPY lerna.json ./
COPY playwright.config.js ./
COPY setup.js ./
COPY report.js ./
COPY reporter.js ./
COPY resultSummary.js ./
COPY bumpDependencies.js ./
COPY batchComponents.js ./
COPY batchGenerate.js ./

# Copy project structure
COPY pages/ ./pages/
COPY tests/ ./tests/
COPY components/ ./components/

# Install and configure
RUN cat .npmrc
RUN apt-get update && apt-get install -y iproute2
RUN npm i -g pnpm
RUN pnpm run ci
RUN npx playwright install-deps
RUN npx playwright install --with-deps
RUN pnpm run setup -- ${RELEASE_VERSION} ${NPM_ARTIFACT} ${version} --verbose || true

RUN if [ -f /tmp/empty_snapshot_detected ]; then exit 86; fi

# Run tests with or without reporting based on IS_PR
RUN if [ "$IS_PR" = "true" ]; then \
      echo "Running Jenkins without reporting..."; \
      pnpm run test:jenkins --verbose || true; \
    else \
      echo "Running Jenkins with reporting..."; \
      export BUILD_CAUSE="$BUILD_CAUSE"; \
      export COMMIT_AUTHOR="$COMMIT_AUTHOR"; \
      export COMMIT_EMAIL="$COMMIT_EMAIL"; \
      export COMMIT_MESSAGE="$COMMIT_MESSAGE"; \
      export UPSTREAM_BRANCH="$UPSTREAM_BRANCH"; \
      export BUILD_NUMBER_UP="$BUILD_NUMBER_UP"; \
      export BUILD_NUMBER_DOWN="$BUILD_NUMBER_DOWN"; \
      export TEAMS_WEBHOOK_URL="$TEAMS_WEBHOOK_URL"; \
      export BUILD_URL="$BUILD_URL"; \
      if [ -f .version ]; then export $(cat .version); fi; \
      pnpm run test:jenkins:report --verbose || true; \
    fi

RUN if [ -f /tmp/batch_out_of_bounds_detected ]; then exit 87; fi