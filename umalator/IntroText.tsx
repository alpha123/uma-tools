import { h } from 'preact';

import './IntroText.css';

export function IntroText(props) {
	return (
		<div id="introtext">
			<details>
				<summary>Caveats</summary>
				The simulator is fairly complete and implements nearly all relevant game mechanics, with the following exceptions:
				<ul>
					<li>
						<details>
							<summary>Pseudo-random skills based on the location of other umas use a best-effort estimation for the distribution of their activation locations which may not be perfectly reflective of in-game behavior in all circumstances</summary>
							<p>Skills that have conditions that require you to be blocked, are based on other umas in your proximity, etc, are modeled according to statistical distributions intended to simulate their in-game behavior but may not be perfectly accurate. It should always find the correct minimum and maximum but the reported mean and median should sometimes be taken with a grain of salt. For example skills with blocked conditions are generally better in races with more umas and worse with fewer. Use your better judgement.</p>
							<p>Skills with conditions with <code>_random</code> in the name (e.g. <code>phase_random</code>, <code>corner_random</code>, <code>straight_random</code>) are implemented identically to the in-game logic and will have more accurate mean/median values, as are skills based purely on the course geometry with no blocked front/side/surrounded conditions.</p>
						</details>
					</li>
					<li>
						<details>
							<summary>Downhill speed-up mode is not implemented</summary>
							Relevant for stamina calculation since downhills save you a pretty good amount of HP on average. Consider the reported HP consumption to be worst-case currently. Minimal if any effect on skill efficacy.
						</details>
					</li>
					<li>
						<details>
							<summary>The <span style="color:rgb(255,119,61);font-weight:bold">Rushed</span> status effect is not implemented</summary>
							Like hills this primarily only impacts HP consumption.
						</details>
					</li>
					<li>
						<details>
							<summary>Skill cooldowns are not implemented</summary>
							Skills only ever activate once even if they have a cooldown like Professor of Curvature or Beeline Burst.
						</details>
					</li>
					<li>
						<details>
							<summary>Unique skill scaling with levels is not implemented</summary>
							Unique skills are always simulated as a base level 3★ unique.
						</details>
					</li>
					<li>
						<details>
							<summary>Speed up mode on Front Runners is not implemented</summary>
							Front Runners have a chance to temporarily speed up based on their wit stat. This is difficult to model and not useful for skill comparisons so it is not implemented, but consider that wit on Front Runners is very slightly more useful than the simulator reports.
						</details>
					</li>
					<li>Motivation is always assumed to be maximum</li>
				</ul>
				By and large it should be highly accurate. It has been battle-tested on the JP server for several years.
			</details>
			<details open={true}>
				<summary>Changelog</summary>
				<section>
					<h2>2025-12-01</h2>
					<ul>
						<li>Update game data</li>
						<li>Update race mechanics to match changes in the first anniversary patch</li>
						<li>
							<details>
								<summary>Add skill point cost and mean length gain per sp columns to skill chart</summary>
								<p>This includes the total cost of the skill, i.e. gold skills including the cost of their white skill, ◎ including ○, etc. Known limitation: costs are not currently reduced for the gold if you already select the white version on the uma being tested. This is because the white version is not removed in the simulation, which will be fixed in a future update.</p>
								<p>Cost calculation does not work for evolved skills in the JP version of the Umalator.</p>
							</details>
						</li>
						<li>Minor bug fixes</li>
					</ul>
				</section>
				<section>
					<h2>2025-08-17</h2>
					<ul>
						<li><strong>Fix to use proper data for hills from the current global version instead of an approximation using data from a later patch</strong> (thanks to <a href="https://github.com/mikumifa">mikumifa</a>)</li>
						<li>Update game data</li>
						<li>Fix a bug where very low stamina on long courses could cause the simulator to freeze</li>
					</ul>
				</section>
				<section>
					<h2>2025-07-28</h2>
					<ul>
						<li>Add caveats section describing the implementation of the simulator</li>
						<li>Allow selecting debuff skills multiple times to simulate multiple debuffers</li>
						<li>Minor UI improvements</li>
					</ul>
				</section>
				<section>
					<h2>2025-07-26</h2>
					<ul>
						<li>Update Tokyo 2400m course to remove the hill at the start to match a game bug where skills do not activate on that hill or the hill does not exist</li>
						<li>Implement per-section int roll target speed modifier</li>
						<li>Simulate skills with the post_number condition more accurately</li>
						<li>Implement the random_lot condition (used by Lucky Seven/Super Lucky Seven)</li>
						<li>Minor UI improvements</li>
					</ul>
				</section>
				<section>
					<h2>2025-07-21</h2>
					<ul>
						<li>Update game data</li>
						<li>Implement debuff skills</li>
						<li>
							<details>
								<summary>Fix the implementation of skills with the corner_random condition to be more accurate to mechanics of the global release</summary>
								Primarily affects Swinging Maestro/Corner Recovery, Professor of Curvature/Corner Adept, and the strategy/distance corner skills
							</details>
						</li>
						<li>Fix an issue where skills weren't displayed on the chart if they were still active at the end of a simulation run</li>
						<li>Added changelog</li>
						<li>Minor UI fixes</li>
					</ul>
				</section>
				<section>
					<h2>2025-07-17</h2>
					<ul>
						<li>Run simulations in a background thread for responsiveness</li>
						<li>
							<details>
								<summary>Major improvements to the skill chart mode</summary>
								<ul>
									<li>Click rows in the skill efficacy table to show that run on the course chart</li>
									<li>Radio buttons in table headers to select the statistic displayed on the course chart</li>
									<li>Show a popup with skill information and length histogram when clicking icons in the skill efficacy table</li>
									<li>Double-click rows on the skill efficacy table to add them to the simulated uma musume</li>
								</ul>
							</details>
						</li>
						<li>Changes to the skill chart mode to feel more responsive</li>
					</ul>
				</section>
				<section>
					<h2>2025-07-16</h2>
					<ul>
						<li>Initial implementation of the skill chart mode</li>
					</ul>
				</section>
				<section>
					<h2>2025-07-13</h2>
					<ul>
						<li>Initial release of the global version</li>
						<li>Miscellaneous UI improvements</li>
						<li>Bug fixes</li>
					</ul>
				</section>
			</details>
			<footer id="sourcelinks">
				Source code: <a href="https://github.com/alpha123/uma-skill-tools">simulator</a>, <a href="https://github.com/alpha123/uma-tools">UI</a>
			</footer>
		</div>
	);
	;}
