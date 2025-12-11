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
    credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.use(router);

router.get('/user/me', authenticate, async (req, res) => {
    res.send(req.user);
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

app.listen(port);