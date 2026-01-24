#!/bin/bash
sudo -u postgres psql -d ibiki -c "SELECT u.id, u.email, u.role, cp.credits FROM client_profiles cp JOIN users u ON u.id = cp.user_id ORDER BY cp.credits DESC LIMIT 10;"
