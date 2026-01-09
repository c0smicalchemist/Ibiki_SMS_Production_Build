import { Router } from 'express';
import { storage } from '../storage';

const router = Router();

router.get('/api/vendors/diagnostics', async (req, res) => {
  try {
    const configs = await storage.getSystemConfig('vendor_configs');
    const vendorConfigs = configs?.value ? JSON.parse(configs.value) : {};
    res.json({ success: true, configs: vendorConfigs });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch diagnostics' });
  }
});

router.get('/api/vendors/config', async (req, res) => {
  try {
    const configs = await storage.getSystemConfig('vendor_configs');
    const vendorConfigs = configs?.value ? JSON.parse(configs.value) : {};
    res.json({ success: true, configs: vendorConfigs });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch vendor configurations' });
  }
});

export default router;
