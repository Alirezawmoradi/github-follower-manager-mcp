import {
  GitHubUser,
  FollowRelationship,
  UnfollowResult,
} from "../models/GitHubUser";

export interface GitHubContext {
  getCurrentUser(): Promise<GitHubUser>;
  getFollowers(): Promise<GitHubUser[]>;
  getFollowing(): Promise<GitHubUser[]>;
  getFollowRelationships(): Promise<FollowRelationship[]>;
  getNotFollowingBack(): Promise<GitHubUser[]>;
  unfollowUser(username: string): Promise<UnfollowResult>;
  unfollowUsers(username: string[]): Promise<UnfollowResult[]>;
}
