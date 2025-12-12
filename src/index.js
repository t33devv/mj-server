require('dotenv').config(); 
const express = require('express');
const app = express();
const port = 4000;

const { sign } = require('jsonwebtoken');

const cors = require('cors');

const db = require('./db');

const router = express.Router();

const axios = require('axios');

const authenticate = require('./middlewares/authenticate');

const cookieParser = require('cookie-parser');



app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(router);

router.get('/getVotes', async (req, res) => {
    try {
        const CURRENT_VOTING_PERIOD = 1;
        
        const voteCounts = await db('votes')
            .where({ voting_period_id: CURRENT_VOTING_PERIOD })
            .select('theme')
            .count('* as count')
            .groupBy('theme')
            .orderBy('count', 'desc');
        
        const totalVotes = await db('votes')
            .where({ voting_period_id: CURRENT_VOTING_PERIOD })
            .count('* as total')
            .first();
        
        res.json({
            success: true,
            voteCounts: voteCounts.map(v => ({
                theme: v.theme,
                count: parseInt(v.count)
            })),
            totalVotes: parseInt(totalVotes.total)
        });
    } catch (error) {
        console.error('Get votes error:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/countUsers', async (req, res) => {
    try {
        const userCountResult = await db('users').count('* as count').first();
        const userCount = parseInt(userCountResult.count);
        
        res.json({
            success: true,
            userCount
        });
    } catch (error) {
        console.error('Count users error:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/user/me', authenticate, async (req, res) => {
    res.send(req.user);
});

router.get('/ping', (req, res) => {
    res.send('pong');
});

router.get('/auth/discord/login', async (req, res) => {
    const redirectUri = encodeURIComponent(process.env.DISCORD_REDIRECT_URI);
    const url = `https://discord.com/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&response_type=code&redirect_uri=${redirectUri}&scope=identify`;
    
    res.redirect(url);
})

router.get('/auth/discord/callback', async (req, res) => {
    if (!req.query.code) {
        throw new Error(res.status(400).send('No code provided'));
    }

    const { code } = req.query;

    const params = new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI,
    })

    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept-Encoding': 'application/x-www-form-urlencoded',
    }

    const response = await axios.post(
        'https://discord.com/api/oauth2/token',
        params.toString(),
        {
            headers
        }
    )

    const userResponse = await axios.get('https://discord.com/api/users/@me', {
        headers: {
            Authorization: `Bearer ${response.data.access_token}`
        }
    })

    const { id, username, avatar} = userResponse.data;

    const checkIfUserExists = await db('users').where({discord_id: id}).first();

    if (checkIfUserExists) {
        await db('users').where({discord_id: id}).update({
            username,
            avatar,
            updated_at: new Date()
        });
    } else {
        await db('users').insert({
            discord_id: id,
            username,
            avatar
        });
    }

    // res.json({
    //     success: true,
    //     user: userResponse.data,
    //     token: response.data.access_token
    // });

    const token = await sign({sub: id}, process.env.JWT_SECRET, {
        expiresIn: '1d'
    });

    res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/'
    });

    res.redirect(process.env.FRONTEND_URL);
})

router.post('/auth/logout', (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/'
    });
    res.json({ success: true, message: 'Logged out' });
});

router.get('/votes/current', authenticate, async (req, res) => {
    try {
        // Use a fixed voting_period_id, change this when you start a new vote
        const CURRENT_VOTING_PERIOD = 1;
        
        const vote = await db('votes')
            .where({
                user_id: req.user.id,
                voting_period_id: CURRENT_VOTING_PERIOD
            })
            .first();
        
        res.json({
            hasVoted: !!vote,
            selectedTheme: vote ? vote.theme : null
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/votes', authenticate, async (req, res) => {
    try {
        const { theme } = req.body;
        const CURRENT_VOTING_PERIOD = 1;
        
        // Check if already voted
        const existingVote = await db('votes')
            .where({
                user_id: req.user.id,
                voting_period_id: CURRENT_VOTING_PERIOD
            })
            .first();
        
        if (existingVote) {
            // Update existing vote (allow changing vote)
            await db('votes')
                .where({ id: existingVote.id })
                .update({
                    theme: theme,
                    updated_at: new Date()
                });
            
            return res.json({ success: true, theme });
        }
        
        // Insert new vote
        await db('votes').insert({
            user_id: req.user.id,
            voting_period_id: CURRENT_VOTING_PERIOD,
            theme: theme
        });
        
        res.json({ success: true, theme });
    } catch (error) {
        console.error('Vote error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Admin: Reset all votes for a jam (add middleware later)
router.delete('/votes/reset/:jamId', authenticate, async (req, res) => {
    try {
        const { jamId } = req.params;
        
        // TODO: Add admin check here
        // if (!req.user.isAdmin) return res.status(403).json({ error: 'Forbidden' });
        
        const deletedCount = await db('votes')
            .where({ jam_id: jamId })
            .delete();
        
        res.json({
            success: true,
            message: `Reset ${deletedCount} votes for jam ${jamId}`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(port);