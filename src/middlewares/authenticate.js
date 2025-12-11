const db = require('../db');
const { verify } = require('jsonwebtoken');

module.exports = async (req, res, next) => {
    try {
        const token = req.cookies.token;
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const decoded = verify(token, process.env.JWT_SECRET);
        console.log('Decoded token:', decoded);

        const user = await db('users')
            .where({ discord_id: decoded.sub })
            .first();

        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }
        
        req.user = user;
        next();
    } catch (err) {
        console.error('Auth error:', err);
        return res.status(401).json({ error: 'Invalid token' });
    }
};