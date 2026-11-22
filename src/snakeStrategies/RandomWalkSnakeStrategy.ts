import { GameState } from "../GameState";
import { Snake } from "../Snake";
import { Address } from "../common";
import { random } from "../util";
import { TargetSnakeStrategy } from "./TargetSnakeStrategy";

export class RandomWalkSnakeStrategy extends TargetSnakeStrategy {
    constructor(public gameState: GameState, public snake: Snake) {
        const target: Address = [];
        for (let d = 0; d < gameState.grid.dimensions.length; d++) {
            target[d] = random(0, gameState.grid.dimensions[d]);
        }
        super(gameState, snake, target);
    }
 
}
