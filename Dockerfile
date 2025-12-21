# Use an official node image as the base image
FROM node:latest

# Set the working directory in the container, app-main to ensure no conflicts
WORKDIR /app-main
COPY . /app-main

# Build verification
RUN npm install --force
RUN npm run build

# Make port 3000 available to the world outside this container, can be changed later
EXPOSE 3000

# Run app
CMD ["npm", "start"]