import { GitHubUser, FollowRelationship } from '../models/GitHubUser';

export interface GitHubContext {
  getCurrentUser(): Promise<GitHubUser>;
  getFollowers(): Promise<GitHubUser[]>;
  getFollowing(): Promise<GitHubUser[]>;
  getFollowRelationships(): Promise<FollowRelationship[]>;
  getNotFollowingBack(): Promise<GitHubUser[]>;
  unfollowUser(username: string): Promise<boolean>;
}