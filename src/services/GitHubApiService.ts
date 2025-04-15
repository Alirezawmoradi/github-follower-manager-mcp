import { Octokit } from "octokit";
import dotenv from 'dotenv';
import {
  GitHubUser,
  FollowRelationship,
  UnfollowResult,
} from "../models/GitHubUser";
import { GitHubContext } from "../contexts/GitHubContext";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import z from "zod";

// Load environment variables
dotenv.config();

const server = new McpServer({
  name: "github-follow-manager",
  description:
    "Manage GitHub followers and unfollow users who don't follow you back",
  version: "1.0.0",
});

export class GitHubApiService implements GitHubContext {
  private octokit: Octokit;
  private username: string;

  constructor() {
    const authToken = process.env.GITHUB_TOKEN;
    if (!authToken) {
      throw new Error('GITHUB_TOKEN environment variable is required.');
    }
    this.octokit = new Octokit({ auth: authToken });
    this.username = "";
  }

  async initialize(): Promise<void> {
    try {
      const { data } = await this.octokit.rest.users.getAuthenticated();
      this.username = data.login;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to initialize GitHub service: ${errorMessage}`);
    }
  }

  async getCurrentUser(): Promise<GitHubUser> {
    try {
      const { data } = await this.octokit.rest.users.getAuthenticated();
      return data as GitHubUser;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get current user: ${errorMessage}`);
    }
  }

  async getFollowers(): Promise<GitHubUser[]> {
    const followers: GitHubUser[] = [];
    let page = 1;
    let hasNextPage = true;

    while (hasNextPage) {
      const { data } =
        await this.octokit.rest.users.listFollowersForAuthenticatedUser({
          per_page: 100,
          page,
        });

      followers.push(...(data as GitHubUser[]));

      if (data.length < 100) {
        hasNextPage = false;
      } else {
        page++;
      }
    }

    return followers;
  }

  async getFollowing(): Promise<GitHubUser[]> {
    const following: GitHubUser[] = [];
    let page = 1;
    let hasNextPage = true;

    while (hasNextPage) {
      const { data } =
        await this.octokit.rest.users.listFollowedByAuthenticatedUser({
          per_page: 100,
          page,
        });

      following.push(...(data as GitHubUser[]));

      if (data.length < 100) {
        hasNextPage = false;
      } else {
        page++;
      }
    }

    return following;
  }

  async getFollowRelationships(): Promise<FollowRelationship[]> {
    const [followers, following] = await Promise.all([
      this.getFollowers(),
      this.getFollowing(),
    ]);

    const followerMap = new Map<string, GitHubUser>();
    followers.forEach((follower) => {
      followerMap.set(follower.login, follower);
    });

    const relationships: FollowRelationship[] = [];

    for (const user of following) {
      const followsYou = followerMap.has(user.login);
      relationships.push({
        user,
        followsYou,
        youFollow: true,
      });
    }

    return relationships;
  }

  async getNotFollowingBack(): Promise<GitHubUser[]> {
    const relationships = await this.getFollowRelationships();
    return relationships
      .filter((rel) => !rel.followsYou && rel.youFollow)
      .map((rel) => rel.user);
  }

  async unfollowUser(username: string): Promise<UnfollowResult> {
    try {
      await this.octokit.rest.users.unfollow({
        username,
      });
      return {
        username,
        success: true,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`Failed to unfollow ${username}:`, error);
      return {
        username,
        success: false,
        error: errorMessage,
      };
    }
  }

  async unfollowUsers(usernames: string[]): Promise<UnfollowResult[]> {
    const results: UnfollowResult[] = [];

    for (const username of usernames) {
      const result = await this.unfollowUser(username);
      results.push(result);
    }

    return results;
  }
}
// Keep a single instance of the GitHub service
let githubService: GitHubApiService | null = null;

// Initialize GitHub service
server.tool(
  "initialize",
  "Initialize the GitHub API service with a personal access token",
  {
    token: z
      .string()
      .describe("GitHub personal access token with appropriate scopes"),
  },
  async ({ token }) => {
    try {
      githubService = new GitHubApiService();
      await githubService.initialize();

      const currentUser = await githubService.getCurrentUser();

      return {
        content: [
          {
            type: "text",
            text: `Successfully authenticated as ${currentUser.login}`,
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      return {
        content: [
          {
            type: "text",
            text: `Failed to initialize GitHub service: ${errorMessage}`,
          },
        ],
      };
    }
  }
);

// Get current authenticated user
server.tool(
  "get-current-user",
  "Get the currently authenticated GitHub user",
  {},
  async () => {
    if (!githubService) {
      return {
        content: [
          {
            type: "text",
            text: "GitHub service not initialized. Please call initialize first.",
          },
        ],
      };
    }

    try {
      const user = await githubService.getCurrentUser();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(user, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      return {
        content: [
          {
            type: "text",
            text: `Failed to get current user: ${errorMessage}`,
          },
        ],
      };
    }
  }
);

// Get users not following back
server.tool(
  "get-not-following-back",
  "Get the list of GitHub users who don't follow you back",
  {},
  async () => {
    if (!githubService) {
      return {
        content: [
          {
            type: "text",
            text: "GitHub service not initialized. Please call initialize first.",
          },
        ],
      };
    }

    try {
      const notFollowingBack = await githubService.getNotFollowingBack();

      if (notFollowingBack.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "Good news! Everyone you follow is following you back.",
            },
          ],
        };
      }

      // Format users as a markdown list with their details
      const userList = notFollowingBack
        .map((user) => {
          return `- **${user.login}** ${
            user.name ? `(${user.name})` : ""
          } - [Profile](${user.html_url})`;
        })
        .join("\n");

      return {
        content: [
          {
            type: "text",
            text: `# Users Not Following You Back (${notFollowingBack.length})\n\n${userList}`,
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      return {
        content: [
          {
            type: "text",
            text: `Failed to get users not following back: ${errorMessage}`,
          },
        ],
      };
    }
  }
);

// Unfollow specific users
server.tool(
  "unfollow-users",
  "Unfollow specific GitHub users",
  {
    usernames: z
      .array(z.string())
      .describe("List of GitHub usernames to unfollow"),
  },
  async ({ usernames }) => {
    if (!githubService) {
      return {
        content: [
          {
            type: "text",
            text: "GitHub service not initialized. Please call initialize first.",
          },
        ],
      };
    }

    if (usernames.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No usernames provided to unfollow.",
          },
        ],
      };
    }

    try {
      const results = await githubService.unfollowUsers(usernames);
      const successful = results.filter((r) => r.success);
      const failed = results.filter((r) => !r.success);

      let responseText = `# Unfollow Results\n\n`;

      if (successful.length > 0) {
        responseText += `## Successfully Unfollowed (${successful.length})\n`;
        successful.forEach((result) => {
          responseText += `- ${result.username}\n`;
        });
      }

      if (failed.length > 0) {
        responseText += `\n## Failed to Unfollow (${failed.length})\n`;
        failed.forEach((result) => {
          responseText += `- ${result.username}: ${
            result.error || "Unknown error"
          }\n`;
        });
      }

      return {
        content: [
          {
            type: "text",
            text: responseText,
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      return {
        content: [
          {
            type: "text",
            text: `Failed to unfollow users: ${errorMessage}`,
          },
        ],
      };
    }
  }
);

// Get follow relationships
server.tool(
  "get-follow-relationships",
  "Get detailed follow relationships for all users you follow",
  {},
  async () => {
    if (!githubService) {
      return {
        content: [
          {
            type: "text",
            text: "GitHub service not initialized. Please call initialize first.",
          },
        ],
      };
    }

    try {
      const relationships = await githubService.getFollowRelationships();

      const mutualFollows = relationships.filter(
        (rel) => rel.followsYou
      ).length;
      const nonFollowBacks = relationships.filter(
        (rel) => !rel.followsYou
      ).length;

      const relationshipsList = relationships
        .map((rel) => {
          return (
            `- **${rel.user.login}** ${
              rel.user.name ? `(${rel.user.name})` : ""
            } - ` +
            `${rel.followsYou ? "✅ Follows you" : "❌ Does not follow you"}`
          );
        })
        .join("\n");

      return {
        content: [
          {
            type: "text",
            text:
              `# Follow Relationships\n\n` +
              `Total Following: ${relationships.length}\n` +
              `Mutual Follows: ${mutualFollows}\n` +
              `Not Following Back: ${nonFollowBacks}\n\n` +
              `## Details\n\n${relationshipsList}`,
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      return {
        content: [
          {
            type: "text",
            text: `Failed to get follow relationships: ${errorMessage}`,
          },
        ],
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("GitHub Follower Manager MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
