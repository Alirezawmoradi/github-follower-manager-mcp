import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { GitHubApiService } from './services/GitHubApiService';
import z from 'zod';

// Create MCP server instance
const server = new McpServer({
  name: 'github-follow-manager',
  description: 'Tools for checking who follows you on GitHub, unfollowing users, and analyzing follow relationships.',
  version: '1.0.0',
});

// Keep a single instance of the GitHub service
let githubService: GitHubApiService | null = null;

// Initialize GitHub service
server.tool(
  'initialize',
  'Initialize the GitHub API service with a personal access token',
  {
    token: z.string().describe('GitHub personal access token with appropriate scopes'),
  },
  async () => {
    try {
      githubService = new GitHubApiService();
      await githubService.initialize();
      
      const currentUser = await githubService.getCurrentUser();
      
      return {
        content: [
          {
            type: 'text',
            text: `Successfully authenticated as ${currentUser.login}`,
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        content: [
          {
            type: 'text',
            text: `Failed to initialize GitHub service: ${errorMessage}`,
          },
        ],
      };
    }
  }
);

// Get current authenticated user
server.tool(
  'get-current-user',
  'Get the currently authenticated GitHub user',
  {},
  async () => {
    if (!githubService) {
      return {
        content: [
          {
            type: 'text',
            text: 'GitHub service not initialized. Please call initialize first.',
          },
        ],
      };
    }
    
    try {
      const user = await githubService.getCurrentUser();
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(user, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        content: [
          {
            type: 'text',
            text: `Failed to get current user: ${errorMessage}`,
          },
        ],
      };
    }
  }
);

// Get users not following back
server.tool(
  'get-not-following-back',
  'Get the list of GitHub users who don\'t follow you back',
  {},
  async () => {
    if (!githubService) {
      return {
        content: [
          {
            type: 'text',
            text: 'GitHub service not initialized. Please call initialize first.',
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
              type: 'text',
              text: 'Good news! Everyone you follow is following you back.',
            },
          ],
        };
      }
      
      // Format users as a markdown list with their details
      const userList = notFollowingBack.map(user => {
        return `- **${user.login}**${user.name ? ` (${user.name})` : ''} - [Profile](${user.html_url})`;
      }).join('\n');
      
      return {
        content: [
          {
            type: 'text',
            text: `# Users Not Following You Back (${notFollowingBack.length})\n\n${userList}`,
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        content: [
          {
            type: 'text',
            text: `Failed to get users not following back: ${errorMessage}`,
          },
        ],
      };
    }
  }
);

// Unfollow specific users
server.tool(
  'unfollow-users',
  'Unfollow specific GitHub users',
  {
    usernames: z.array(z.string()).describe('List of GitHub usernames to unfollow'),
  },
  async ({ usernames }) => {
    if (!githubService) {
      return {
        content: [
          {
            type: 'text',
            text: 'GitHub service not initialized. Please call initialize first.',
          },
        ],
      };
    }
    
    if (usernames.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No usernames provided to unfollow.',
          },
        ],
      };
    }
    
    try {
      const results = await githubService.unfollowUsers(usernames);
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);
      
      let responseText = `# Unfollow Results\n\n`;
      
      if (successful.length > 0) {
        responseText += `## Successfully Unfollowed (${successful.length})\n`;
        successful.forEach(result => {
          responseText += `- ${result.username}\n`;
        });
      }
      
      if (failed.length > 0) {
        responseText += `\n## Failed to Unfollow (${failed.length})\n`;
        failed.forEach(result => {
          responseText += `- ${result.username}: ${result.error || 'Unknown error'}\n`;
        });
      }
      
      return {
        content: [
          {
            type: 'text',
            text: responseText,
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        content: [
          {
            type: 'text',
            text: `Failed to unfollow users: ${errorMessage}`,
          },
        ],
      };
    }
  }
);

// Get follow relationships
server.tool(
  'get-follow-relationships',
  'Get detailed follow relationships for all users you follow',
  {},
  async () => {
    if (!githubService) {
      return {
        content: [
          {
            type: 'text',
            text: 'GitHub service not initialized. Please call initialize first.',
          },
        ],
      };
    }
    
    try {
      const relationships = await githubService.getFollowRelationships();
      
      const mutualFollows = relationships.filter(rel => rel.followsYou).length;
      const nonFollowBacks = relationships.filter(rel => !rel.followsYou).length;
      
      const relationshipsList = relationships.map(rel => {
        return `- **${rel.user.login}**${rel.user.name ? ` (${rel.user.name})` : ''} - ${rel.followsYou ? '✅ Follows you' : '❌ Does not follow you'}`;
      }).join('\n');
      
      const text = [
        '# Follow Relationships',
        '',
        `Total Following: ${relationships.length}`,
        `Mutual Follows: ${mutualFollows}`,
        `Not Following Back: ${nonFollowBacks}`,
        '',
        '## Details',
        '',
        relationshipsList
      ].join('\n');
      
      return {
        content: [
          {
            type: 'text',
            text,
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        content: [
          {
            type: 'text',
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
  console.error('GitHub Follower Manager MCP Server running on stdio');
}

main().catch(error => {
  console.error('Fatal error in main():', error);
  process.exit(1);
}); 