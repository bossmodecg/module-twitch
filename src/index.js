import Module from '@bossmodecg/module';

import TwitchAPI from 'node-twitch-api';
import { client as TMIClient } from 'tmi.js';
import _ from 'lodash';

// Best way to get an OAuth token:
// https://twitchapps.com/tokengen

const DEFAULT_CONFIG =
  {
    options: {
      connection_text: "BossmodeCG connected.",
      new_follower_spacing: 60
    },
    connection: {
      reconnect: true
    },
    identity: {},
    channel: null
  };

const TWITCH_SCOPE =
  "channel_read channel_editor channel_commercial " +
  "channel_subscriptions chat_login channel_feed_read channel_feed_edit";

export default class TwitchModule extends Module {
  constructor(config) {
    super("twitch", config);

    this._configureTmi = this._configureTmi.bind(this);
    this._configureTwitchApi = this._configureTwitchApi.bind(this);

    this._twitchFollowers = new Set();
    this._newFollowers = [];

    this.on("internal.registerServer", async (server) => {
      await this._configureTwitchApi();
      await this._configureTmi(server);
    });
  }

  /* eslint-disable class-methods-use-this */
  get defaultConfig() { return DEFAULT_CONFIG; }
  /* eslint-enable class-methods-use-this */

  async _configureTwitchApi() {
    const config = this.config;
    // const POLL_INTERVAL = 61 * 1000;

    this._twitchClient = new TwitchAPI({
      client_id: config.oauthClientId,
      access_token: config.identity.password,
      scope: TWITCH_SCOPE
    });

    // TODO: implement follower polling and emit events for new followers.
  }

  async _configureTmi(server) {
    const config = _.cloneDeep(this.config);
    config.channels = [config.channel];

    const logger = this.logger;
    const tmiTwitch = new TMIClient(config);

    // TODO: poll periodically for new followers; spread out new follower notifications
    tmiTwitch.on("connecting", () => {
      logger.info(`Connecting to Twitch as user '${this.config.identity.username}'.`);
    });

    tmiTwitch.on("connected", (address, port) => {
      logger.info("Connected to Twitch.");

      if (config.options.connection_text) {
        tmiTwitch.say(config.channel, config.options.connection_text);
      }

      server.emit("twitch.connected", { address, port });
    });

    tmiTwitch.on("disconnected", (address, port) => {
      logger.warn("Disconnected from Twitch.");

      server.emit("twitch.disconnected", { address, port });
    });

    tmiTwitch.on("cheer", (channel, userstate, message) => {
      logger.info(`Cheer received on ${channel}, ${userstate.bits} bits.`);

      server.emit("twitch.cheer", { channel, userstate, message });
    });

    tmiTwitch.on("hosted", (channel, username, viewers) => {
      logger.info(`Hosted: ${channel} now hosted by ${username} (${viewers} viewers).`);

      server.emit("twitch.hosted", { channel, username, viewers });
    });

    tmiTwitch.on("action", (channel, userstate, message, self) => {
      server.emit("twitch.action", { channel, userstate, message, self });
    });

    tmiTwitch.on("chat", (channel, userstate, message, self) => {
      server.emit("twitch.chat", { channel, userstate, message, self });
    });

    tmiTwitch.on("whisper", (from, userstate, message, self) => {
      server.emit("twitch.whisper", { from, userstate, message, self });
    });

    tmiTwitch.on("message", (channel, userstate, message, self) => {
      server.emit("twitch.message", { channel, userstate, message, self });
    });

    tmiTwitch.on("resub", (channel, username, months, message, userstate, methods) => {
      server.emit("twitch.resub", { channel, username, months, message, userstate, methods });
    });

    tmiTwitch.connect();
  }
}
