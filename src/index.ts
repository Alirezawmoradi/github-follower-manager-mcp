import inquirer from 'inquirer';
import { loadConfig, validateConfig } from './utils/config';
import { GitHubApiService } from './services/GitHubApiService';
import { GitHubUser } from './models/GitHubUser';

async function main() {
  try {
    // Load configuration
    const config = loadConfig();
    validateConfig(config);

    // Initialize GitHub service
    const githubService = new GitHubApiService(config.githubToken);
    await githubService.initialize();

    // Get current user
    const currentUser = await githubService.getCurrentUser();
    console.log(`Logged in as ${currentUser.login}`);

    // Get users not following back
    console.log('Fetching your followers and following lists...');
    const notFollowingBack = await githubService.getNotFollowingBack();
    
    if (notFollowingBack.length === 0) {
      console.log('Good news! Everyone you follow is following you back.');
      return;
    }

    console.log(`\nFound ${notFollowingBack.length} users who don't follow you back:`);
    notFollowingBack.forEach((user, index) => {
      console.log(`${index + 1}. ${user.login} (${user.html_url})`);
    });

    // Ask which users to unfollow
    const { selectedUsers } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedUsers',
        message: 'Select users to unfollow:',
        choices: notFollowingBack.map(user => ({
          name: `${user.login}${user.name ? ` (${user.name})` : ''}`,
          value: user.login
        })),
      }
    ]);

    if (selectedUsers.length === 0) {
      console.log('No users selected for unfollowing. Exiting...');
      return;
    }

    // Confirm before unfollowing
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Are you sure you want to unfollow ${selectedUsers.length} user(s)?`,
        default: false,
      }
    ]);

    if (!confirm) {
      console.log('Operation cancelled. No users were unfollowed.');
      return;
    }

    // Unfollow selected users
    console.log('\nUnfollowing selected users...');
    let successCount = 0;

    for (const username of selectedUsers) {
      process.stdout.write(`Unfollowing ${username}... `);
      const success = await githubService.unfollowUser(username);
      
      if (success) {
        console.log('✓');
        successCount++;
      } else {
        console.log('✗');
      }
    }

    console.log(`\nSuccessfully unfollowed ${successCount} user(s).`);

  } catch (error) {
    console.error('An error occurred:', error);
    process.exit(1);
  }
}

main();