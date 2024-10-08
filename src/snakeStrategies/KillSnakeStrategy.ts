import { GameState } from "../GameState";
import { Snake } from "../Snake";
import { Action } from "../action";
import { allSteps, distance, nextSteps, toFlat } from "../address";
import { Address } from "../common";
import { isDefined, pickRandom } from "../util";
import { TargetSnakeStrategy } from "./TargetSnakeStrategy";

export class KillSnakeStrategy extends TargetSnakeStrategy {
    public targetPlayerName: string | undefined;

    constructor(public gameState: GameState, public snake: Snake) {
        const target = [-1];
        super(gameState, snake, target);
    }

    private _pickTargetPlayer(): string | undefined {
        const highestEnemies = [...this.gameState.enemyScore.entries()];
        highestEnemies.sort((e1, e2) => e2[1] - e1[1]);
        return highestEnemies[0]?.[0];
    }

    private _pickTarget(): void {
        const targetName = this.targetPlayerName;
        if (!targetName || targetName === this.gameState.playerName) {
            this.targetPlayerName = undefined;
            this.target = [-1];
            this.snake.log("no target available");
            return;
        }
        this.targetPlayerName = targetName;
        const enemyPlayerCells = [...this.gameState.grid.cells.values()].filter(
            (cell) => cell.player === this.targetPlayerName
        );

        const otherKamikazeTargets = this.gameState.snakes.map(x => x.target).filter(isDefined);
        
        const untargetedEnemyPlayerCells = enemyPlayerCells.filter((cell) => !otherKamikazeTargets.find(item => cell.address === item));

        untargetedEnemyPlayerCells.sort((c1, c2) => {
            return (
                distance(c1.address, this.snake.head) -
                distance(c2.address, this.snake.head)
            );
        });
        this.target = untargetedEnemyPlayerCells[0]?.address ?? [-1];
        this.snake.log(`selected ${this.targetPlayerName} ${this.target}`);
    }

    isDone(): string | undefined {
        return undefined;
    }

    update(): Action[] {
        if (this.target[0] !== -1) {
            if (
                this.gameState.getCell(this.target).player !==
                this.targetPlayerName
            ) {
                this.snake.log("target lost, finding new one");
                this.target = [-1];
            }
            else {
                // Update the target to keep selecting the closest cell of that player.
                this._pickTarget();
            }
        }
        if (this.target[0] === -1) {
            if (!this.targetPlayerName) {
                this.targetPlayerName = this._pickTargetPlayer();
            } 
            this._pickTarget();
        }
        if (this.target[0] === -1) {
            this.targetPlayerName = undefined;
            this.snake.target = undefined;
            return [];
        }
        else {
            this.snake.target = this.target;
        }

        return super.update();
    }

    determineNextStep(): Address | undefined {
        const possibleNextSteps = nextSteps(this.snake.head, this.target);
        let availableSteps =
            this.gameState.grid.filterAvailable(possibleNextSteps, this.targetPlayerName);
        if (availableSteps.length === 0) {
            const allPossibleSteps = allSteps(this.snake.head, this.target);
            availableSteps =
                this.gameState.grid.filterAvailable(allPossibleSteps, this.targetPlayerName);
        }
        return pickRandom(availableSteps);
    }

    inspect(): string {
        return `[${this.constructor.name} target=${toFlat(this.target)} enemy=${
            this.targetPlayerName
        }]`;
    }
}
