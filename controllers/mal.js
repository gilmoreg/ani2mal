/* eslint-disable no-unused-vars */
const fetch = require('node-fetch');
const xml2js = require('xml2js');
const mongoose = require('mongoose');
const IDHash = require('../models/IDHash');
// require('dotenv').config();
const parser = new xml2js.Parser();

const parseMalID = (malRes) => {
  if (malRes && malRes.anime && malRes.anime.entry) {
    return malRes.anime.entry[0].id[0];
  }
  return null;
};

const getDBmalID = aniTitle =>
  new Promise((resolve, reject) => {
    IDHash.findOne({ aniTitle }, { malID: true, _id: false })
    .then(res => resolve(res))
    .catch(err => reject(err));
  });

const setDBmalID = (aniTitle, malID) =>
  new Promise((resolve, reject) => {
    IDHash.create({ aniTitle, malID: parseInt(malID, 10) })
    .then(res => resolve(res))
    .catch(err => reject(err));
  });

const malAPICall = (auth, url) =>
  fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${auth}`,
    },
  })
  .then(mal => mal.text());

const malAPISearch = (auth, title) =>
  new Promise((resolve, reject) => {
    malAPICall(auth, `https://myanimelist.net/api/anime/search.xml?q=${encodeURIComponent(title)}`)
    .then((res) => {
      if (res) {
        parser.parseString(res, (err, data) => {
          if (err) reject(err);
          const malID = parseMalID(data);
          if (malID) {
            // Add this title/id hash to database
            setDBmalID(title, malID);
            // Return MAL ID
            console.log('MAL ID', malID);
            resolve({ malID });
          }
          // Got a response but incorrectly formatted
          // Treat it as no results
          resolve(null);
        });
      }
      // Got no response - MAL's response on no results
      resolve(null);
    })
    .catch(err => reject(err));
  });

const addToMal = (auth, id, xml) =>
  new Promise((resolve, reject) => {
    malAPICall(auth, `https://myanimelist.net/api/animelist/add/${id}.xml?data=${xml}`)
    .then(res => resolve(res))
    .catch(err => reject(err));
  });

const checkMalCredentials = auth =>
  new Promise((resolve, reject) => {
    malAPICall(auth, 'https://myanimelist.net/api/account/verify_credentials.xml')
    .then(res => resolve(res))
    .catch(err => reject(err));
  });

const searchMal = (auth, titles) =>
  // See if we have this match stored
  new Promise(async (resolve, reject) => {
    // First item must always be Romaji, which is what the DB stores
    let malID = await getDBmalID(titles[0]);
    console.log('dbMalID', malID);
    if (malID) resolve(malID);
    else {
      // Nothing in the DB. Try searching MAL
      // Romaji
      malID = await malAPISearch(auth, titles[0]);
      console.log('romaji', malID);
      if (malID) resolve(malID);
      // English
      if (titles.length > 1) {
        malID = await malAPISearch(auth, titles[1]);
        if (malID) resolve(malID);
      }
      // Japanese
      if (titles.length > 2) {
        malID = await malAPISearch(auth, titles[2]);
        if (malID) resolve(malID);
      }
      // Nothing found
      resolve(`${titles[0]} not found on MAL.`);
    }
  });

module.exports = {
  search: async (req, res) => {
    const result = await searchMal(req.body.auth, req.body.titles);
    res.status(200).json(result);
  },
  add: async (req, res) => {
    const result = await addToMal(req.body.auth, req.body.id, req.body.xml);
    res.status(200).json(result);
  },
  check: async (req, res) => {
    const results = await checkMalCredentials(req.body.auth);
    res.status(200).json(results);
  },
};
