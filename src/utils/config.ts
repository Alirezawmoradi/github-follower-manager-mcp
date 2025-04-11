import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables from .env file
dotenv.config();

export interface Config {
  githubToken: string;
}

export function loadConfig(): Config {
  const githubToken = process.env.GITHUB_TOKEN;

  if (!githubToken) {
    throw new Error('GITHUB_TOKEN is required in environment variables or .env file');
  }

  return {
    githubToken,
  };
}

export function validateConfig(config: Config): void {
  if (!config.githubToken) {
    console.error('GitHub token is missing. Please set GITHUB_TOKEN in your .env file.');
    console.error('You can create a personal access token at https://github.com/settings/tokens');
    process.exit(1);
  }
}