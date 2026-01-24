#!/bin/bash
# Add 10 credits to ibiki_dash@proton.me admin account
sudo -u postgres psql -d ibiki -c "UPDATE client_profiles SET credits = credits + 10 WHERE user_id = 'e1aae222-3a4a-4a11-bfb3-6be1bed76723';"
sudo -u postgres psql -d ibiki -c "SELECT u.email, cp.credits FROM client_profiles cp JOIN users u ON u.id = cp.user_id WHERE u.email = 'ibiki_dash@proton.me';"
