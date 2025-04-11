export interface GitHubUser {
    login: string;
    id: number;
    avatar_url: string;
    html_url: string;
    name?: string;
    bio?: string;
    public_repos?: number;
    followers?: number;
    following?: number;
  }
  
  export interface FollowRelationship {
    user: GitHubUser;
    followsYou: boolean;
    youFollow: boolean;
  }