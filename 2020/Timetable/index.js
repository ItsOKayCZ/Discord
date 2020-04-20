require('dotenv').config();
const { Client, MessageEmbed } = require('discord.js');
const bot = new Client();
const TOKEN = process.env.TOKEN;
const fs = require('fs');

// Bot varibles
var embedColor = 0x7ae8ff;
var channel;
var channelName = ''; // Enter name of notification room

bot.login(TOKEN);

/*
 * timetable structure
 * {
 * 	"Monday": [
 *	 {
 *	  "Name": "AJ",
 *	  "url": "jitsi.ssps.cz/something",
 *	  "Time": "10:00",
 *
 *	  # Variations
 *	  "Groups": "1. skupina",
 *	  "Groups": "2. skupina",
 *	  "Groups": "everyone",
 *	  "Groups": "divided"
 *	 }
 * 	],
 * 	"Tuesday": [
 * 	 ...
 * 	]
 * }
 */
var timetable;


bot.on('ready', function(){
	console.info(`Logged in as ${bot.user.tag}!`);

	var rawdata = fs.readFileSync('timetable.json');
	timetable = JSON.parse(rawdata);

	channel = bot.channels.cache.find(function(channel){
		if(channel.name == channelName){
			return channel;
		}
	});

	checkClass();
	setInterval(checkClass, 1000 * 60);
});

bot.on('message', function(message){
	if(message.content == '!help'){

		var embed = createMessage();
		embed.setTitle('Help')
		.setDescription('**!schedule**\nShows the time table\n\n**!classes**\nShows the upcoming classes\n\n**!ping**');
		message.channel.send(embed);
		
	} else if(message.content == '!classes'){
		checkTimetable(false, message);
	} else if(message.content == '!ping'){
		message.channel.send('Pong');
	} else if(message.content == '!schedule'){
		printSchedule(message);
	}
});

var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Prints the lessons for the current day and highlights the upcoming one
 * @param tagUsers	-> Should the message tag users
 * @param message	-> The message from the channel that called this function
 */
function checkTimetable(tagUsers = false, message = undefined){
	var [currentClass, classes] = getCurrentClass();

	if(currentClass == undefined){

		var embed = createMessage()
		.setTitle(`No more classes for today`);

	} else {
		var date = new Date();
		var timeLeft = getDateSub(currentClass['Time'], `${date.getHours()}:${date.getMinutes()}`);

		var url = currentClass['url'];
		if(url.indexOf('#') == 0){
			url = getRoomId(url.substring(1, url.length));
		}

		var embed = createMessage()
		.setTitle(`Class: ${currentClass['Name']}`)
		.setDescription(`${currentClass['Name']} will start in ${timeLeft[0] * 60 + timeLeft[1]} minutes (${currentClass['Time']}).\nAddress: ${url}\nGroup: ${getRoleId(currentClass['Group'], tagUsers)}`);

		if(currentClass['url'].indexOf('http') != -1){
			embed.setURL(currentClass['url']);
		}

		if(classes.length == 0){
			embed.setDescription(embed.description + '\n\n\n**No more classes**');
		} else {
			embed.setDescription(embed.description + '\n\n\n**Upcoming classes**');
			for(var i = 0; i < classes.length; i++){
				embed.addField(`**${classes[i]['Name']}**`, `Start: ${classes[i]['Time']}\nGroup: ${getRoleId(classes[i]['Group'])}`, false);
			}
		}
	}

	if(message != undefined){
		message.channel.send(embed);
	} else {
		channel.send(embed);
	}
}

/**
 * Checks do 2 times
 * Format of time (String) hours:minutes -> "10:25"
 * @param time1	-> First time
 * @param time2 -> Second time
 * @param difference -> What to check for ('early', 'equal', 'late')
 * @return Returns a boolean if the statement is true or false
 */
function checkTimes(time1, time2, difference){
	var [hours1, minutes1] = time1.split(':');
	var [hours2, minutes2] = time2.split(':');
	hours1 = parseInt(hours1);
	minutes1 = parseInt(minutes1);
	hours2 = parseInt(hours2);
	minutes2 = parseInt(minutes2);

	if(difference == 'early'){
		if(hours1 < hours2 || (hours1 == hours2 && minutes1 < minutes2)){
			return true;
		}
	} else if(difference == 'equal'){
		if(time1 == time2){
			return true;
		}
	} else if(difference == 'late'){
		if(hours1 > hours2 || (hours1 == hours2 && mintes1 > minutes2)){
			return true;
		}
	}
	
	return false;
}

/**
 * Creates a message embed with some attributes and returns it
 * @return Returns the message embed class
 */
function createMessage(){
	var embed = new MessageEmbed()
	.setAuthor('Timetable bot [Github](https://github.com/ItsOKayCZ/Discord/tree/master/2020/Timetable)')
	.setColor(embedColor);

	return embed;
}

/**
 * Checks if a lesson is in the next 5 minutes and if so, sends a message 
 */
function checkClass(){
	var [currentClass, classes] = getCurrentClass();
	if(currentClass == undefined){
		return;
	}

	var date = new Date();
	var timeLeft = getDateSub(currentClass['Time'], `${date.getHours()}:${date.getMinutes()}`);
	var minutes = timeLeft[0] * 60 + timeLeft[1];
	console.log(`Time left to next lesson: ${minutes}`);
	if(minutes == 5){
		checkTimetable(true);
	}
}

/**
 * Displays the schedule for the whole week with times
 * @param message	-> The message from the channel that calls the function
 */
function printSchedule(message){
	var embd = createMessage()
	.setTitle('Timetable schedule')
	.setDescription('You can download the excel table for timetable')
	.attachFiles('timetable.xlsx');

	var tempDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
	for(var i = 0; i < tempDays.length; i++){
		var str = "";
		for(var j = 0; j < timetable[tempDays[i]].length; j++){
			str += `**${timetable[tempDays[i]][j]['Name']} (${timetable[tempDays[i]][j]['Time']})** | `;
		}
		embed.addField(`**${tempDays[i]}**`, str, false); 
	}

	message.channel.send(embed);
}

/**
 * Substracts 2 times from eachother
 * @param time1	-> First time
 * @param time2	-> Second time
 * @return An array with the first element of substracted hours and second minutes
 */
function getDateSub(time1, time2){
	var [hours1, minutes1] = time1.split(':');
	var [hours2, minutes2] = time2.split(':');
	hours1 = parseInt(hours1);
	minutes1 = parseInt(minutes1);
	hours2 = parseInt(hours2);
	minutes2 = parseInt(minutes2);

	return [hours1 - hours2, minutes1 - minutes2];
}

/**
 * Gets the upcoming class info
 * @return Returns an array of the upcoming class and upcoming classes
 */
function getCurrentClass(){
	var date = new Date();
	var day = days[date.getDay()];
	var hours = date.getHours();
	var minutes = date.getMinutes();

	var currentClass;
	var classes = [];
	var index = -1;
	for(var i = 0; i < timetable[day].length; i++){
		if(checkTimes(`${hours}:${minutes}`, timetable[day][i]['Time'], 'early')){
			currentClass = timetable[day][i];
			index = i;
			break;
		}
	}

	classes = timetable[day].slice(index + 1, timetable[day].length);

	return [currentClass, classes];
}

/**
 * Gets id of role
 * @param role
 * @return Returns role id
 */
function getRoleId(roleName, tagUsers = false){
	if(roleName == 'divided'){
		if(getWeekNumber(new Date())[1] % 2 == 0){
			roleName = '2. polovina';
		} else {
			roleName = '1. polovina';
		}
	}
	
	if(tagUsers == false){
		return roleName;
	}

	var id;

	id = bot.guilds.cache.first().roles.cache.find(function(role){
		if(role.name == roleName){
			return role;
		} else if(role.name == `@${roleName}`){
			return role;
		}
	});

	if(id == undefined){
		return `@${roleName}`;
	}

	return id;
}

/**
 * Calculates the number of the week
 * @param d	-> The current date
 * @return Returns the number of the week
 *
 * @source https://stackoverflow.com/questions/6117814/get-week-of-year-in-javascript-like-in-php
 */
function getWeekNumber(d) {
    // Copy date so don't modify original
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    // Set to nearest Thursday: current date + 4 - current day number
    // Make Sunday's day number 7
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    // Get first day of year
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    // Calculate full weeks to nearest Thursday
    var weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
    // Return array of year and week number
    return [d.getUTCFullYear(), weekNo];
}

/**
 * Gets the id of a room in the guild
 * @param roomName	-> The name of the room
 */
function getRoomId(roomName){
	var id;

	id = bot.channels.cache.find(function(room){
		if(room.name == roomName){
			return room.id;
		}
	});
	
	return id;
}
