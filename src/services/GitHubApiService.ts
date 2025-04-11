import { Octokit } from 'octokit';
import { GitHubUser, FollowRelationship } from '../models/GitHubUser';
import { GitHubContext } from '../contexts/GitHubContext';

export class GitHubApiService implements GitHubContext {
  private octokit: Octokit;
  private username: string;

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token });
    this.username = '';
  }

  async initialize(): Promise<void> {
    const { data } = await this.octokit.rest.users.getAuthenticated();
    this.username = data.login;
  }

  async getCurrentUser(): Promise<GitHubUser> {
    const { data } = await this.octokit.rest.users.getAuthenticated();
    return data as GitHubUser;
  }

  async getFollowers(): Promise<GitHubUser[]> {
    const followers: GitHubUser[] = [];
    let page = 1;
    let hasNextPage = true;

    while (hasNextPage) {
      const { data } = await this.octokit.rest.users.listFollowersForAuthenticatedUser({
        per_page: 100,
        page,
      });

      followers.push(...data as GitHubUser[]);
      
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
        const { data } = await this.octokit.rest.users.listFollowedByAuthenticatedUser({
        per_page: 100,
        page,
      });

      following.push(...data as GitHubUser[]);
      
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
    followers.forEach(follower => {
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
      .filter(rel => !rel.followsYou && rel.youFollow)
      .map(rel => rel.user);
  }

  async unfollowUser(username: string): Promise<boolean> {
    try {
      await this.octokit.rest.users.unfollow({
        username,
      });
      return true;
    } catch (error) {
      console.error(`Failed to unfollow ${username}:`, error);
      return false;
    }
  }
}