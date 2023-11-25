import https from "https";
import fs from "fs/promises";
import path from "path";

function get(url: string) {
	return new Promise<string>((resolve, reject) => {
		https.get(url, (res) => {
			let output = "";
			res.on("data", (chunk) => {
				output += chunk;
			});
			res.on("error", reject);
			res.on("end", () => {
				resolve(output);
			});
		});
	});
}

async function main() {
	const latest = JSON.parse(
		await get(
			"https://raw.githubusercontent.com/RobloxAPI/build-archive/master/data/production/latest.json",
		),
	);
	const latestGuid = latest.GUID;

	const build = JSON.parse(
		await get(
			`https://raw.githubusercontent.com/RobloxAPI/build-archive/master/data/production/builds/${latestGuid}/API-Dump.json`,
		),
	);
	const classes = (build.Classes as Array<any>).map(
		(classs) => classs.Name,
	) as string[];

	const doubleClass: { [key: string]: string } = {};

	classes.forEach((classs) => {
		doubleClass[classs.toLowerCase()] = classs;
	});
	const classes_path = path.join(__dirname, "../src/", "classes.json");
	const stats = await fs.stat(classes_path).catch((e) => {
		if (e.code === "ENOENT") {
			return void 0;
		} else {
			fs.rm(classes_path);
		}
	});

	setTimeout(() =>
		fs.writeFile(
			path.join(__dirname, "../src/", "classes.json"),
			JSON.stringify(doubleClass),
		),
	);
}

main();
