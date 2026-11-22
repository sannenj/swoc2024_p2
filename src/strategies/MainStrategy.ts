import { GameState } from "../GameState";
import { Snake } from "../Snake";
import { Action, ActionType, SplitAction } from "../action";
import { toFlat } from "../address";
import { Address, SnakeName } from "../common";
import { FoodSnakeStrategy } from "../snakeStrategies/FoodSnakeStrategy";
import { KillSnakeStrategy } from "../snakeStrategies/KillSnakeStrategy";
import { RandomWalkSnakeStrategy } from "../snakeStrategies/RandomWalkSnakeStrategy";
import { SaveSnakeStrategy } from "../snakeStrategies/SaveSnakeStrategy";
import { SnakeStrategy } from "../snakeStrategies/SnakeStrategy";
import { Strategy } from "../strategy";
import { isDefined } from "../util";

export class MainStrategy implements Strategy {
    snakeStrategies: Map<SnakeName, SnakeStrategy> = new Map();
    splitCount: number = 0;
    nr_of_saving_snakes: number = 0;

    constructor(
        public gameState: GameState,
        public saveLength: number = 8,
        public maxNumberOfSavingSnakes: number = 25,
        public kamikazeLength: number = 3,
        public desiredMainSnakes: number = 20,
        public desiredKamikazeSnakes: number = 4,
        public foodPerSnake: number = 1,
    ) {}

    update(): Action[] {
        this.splitCount = 0;
        this.cleanStrategies()
        return [
            ...this.executeKamikazeStrategies(),
            ...this.executeSplitStrategies(),
            ...this.executeSnakeStrategies(),
        ];
    }

    inspect(): string {
        return this.gameState.snakes
            .map((snake) => {
                const strat = this.snakeStrategies.get(snake.name);
                return `[${snake.name}:${snake.length}] head=${toFlat(
                    snake.head
                )} strategy=${strat?.inspect()}`;
            })
            .join("\n");
    }

    getNextAddress(
        gameState: GameState,
        address: Address
    ): Address | undefined {
        let i = 10;
        while (i-- > 0) {
            var newaddr = [...address];
            var dim = Math.floor(
                Math.random() * gameState.grid.dimensions.length
            );
            var dir = Math.floor(Math.random() * 2);
            if (dir > 0) {
                newaddr[dim] += 1;
            } else {
                newaddr[dim] -= 1;
            }
            if (gameState.grid.checkBounds(newaddr)) {
                var cell = gameState.getCell(newaddr);
                if (!cell.player) {
                    return newaddr;
                }
            }
        }
    }

    splitSnake(
        snake: Snake,
        gameState: GameState,
        amount: number,
        kamikaze: boolean
    ): Action | undefined {
        const kidSnake = snake.getKid(1);
        const next = this.getNextAddress(gameState, kidSnake.head);
        if (next) {
            const splitAction: SplitAction = {
                type: ActionType.Split,
                newSnakeName: kidSnake.name + (kamikaze ? "_k" : ""),
                oldSnakeName: snake.name,
                snakeSegment: kidSnake.length,
                nextLocation: next,
            };
            return splitAction;
        }
    }

    cleanStrategies(): void {
        const snakeNames : string[] = this.gameState.snakes.map((snake) => snake.name)
        this.snakeStrategies.forEach((strategy,key,map) => {
            if (!snakeNames.includes(key)) {
                if (strategy.save()) {
                    this.nr_of_saving_snakes--
                }

                console.log(`Deleted strategy for snake: ${key}`)
                this.snakeStrategies.delete(key)
            }
        });
    }

    executeSplitStrategies(): Action[] {
        const actions: Action[] = [];
        for (const snake of this.gameState.snakes) {
            if (
                this.gameState.snakes.length + this.splitCount <
                Math.min(
                    this.desiredMainSnakes,
                    this.gameState.foodManager.foods.size
                )
            ) {
                // Only split if there is enough food left
                if (this.gameState.snakes.length + this.splitCount < (this.gameState.foodManager.foods.size / this.foodPerSnake)) {
                    if (snake.length > 1) {
                        // Split when we have splittable snakes until we have enough snakes.
                        snake.log(`splitting`);
                        const kid = this.splitSnake(
                            snake,
                            this.gameState,
                            1,
                            false
                        );
                        if (kid) {
                            this.splitCount++;
                            actions.push(kid);
                        }
                    }
                }
            }
        }

        return actions;
    }

    executeKamikazeStrategies(): Action[] {
        const actions: Action[] = [];
        const kamikazeCount = this.gameState.snakes.filter((snake) =>
            snake.name.endsWith("_k")
        ).length;

        for (const snake of this.gameState.snakes) {
            // snake.log(
            //     `Kamikaze? enemies: ${this.gameState.enemyCellCounts.keys.length}, kamikazeCount: ${kamikazeCount}, splitCount: ${this.splitCount}`
            // );

            if (
                // this.gameState.snakes.length + this.splitCount >
                //     this.desiredMainSnakes &&
                kamikazeCount + this.splitCount <
                Math.min(
                    this.desiredKamikazeSnakes,
                    this.gameState.enemyCellCount
                )
            ) {

                snake.log(
                    `Enemy count: ${this.gameState.enemyCellCounts.keys.length}, kamikazeCount: ${kamikazeCount}`
                );
        
                if (snake.length > 2 && snake.length >= this.kamikazeLength) {
                    // Split when we have splittable snakes until we have enough snakes.
                    snake.log(`splitting kamikaze`);
                    const kid = this.splitSnake(snake, this.gameState, 1, true);
                    if (kid) {
                        this.splitCount++;
                        actions.push(kid);
                    }
                }
            }
        }

        return actions;
    }

    executeSnakeStrategies(): Action[] {
        const actions: Action[] = [];
        // Remove snakestrategies for snakes that no longer exist
        for (const [snakeName, _snakeStrat] of [
            ...this.snakeStrategies.entries(),
        ]) {
            if (!this.gameState.getSnake(snakeName)) {
                this.snakeStrategies.delete(snakeName);
            }
        }
        for (const snake of this.gameState.snakes) {
            let snakeStrat = this.snakeStrategies.get(snake.name);
            // Remove target if it's no longer applicable
            if (snakeStrat) {
                // Target reached?
                const doneReason = snakeStrat.isDone();
                if (doneReason) {
                    snake.log(
                        `target done (${doneReason}), was ${snakeStrat.inspect()}`
                    );

                    if (snakeStrat instanceof SaveSnakeStrategy) {
                        snake.log(
                            `saved`
                        );
                        this.gameState.savedSnake();
                        this.nr_of_saving_snakes--
                    }

                    snakeStrat = undefined;
                }
            }
            if (!snakeStrat && snake.name.endsWith("_k")) {
                // Determine if we have a kamikaze snake and set its stragetgy accordingly
                snake.log(`assigned kamikaze strategy`);
                snakeStrat = new KillSnakeStrategy(this.gameState, snake);
            }
            if (!snakeStrat) {
                // Determine which foods are being targeted by our snakes right now
                const lockedFoodsFlatAddresses = new Set(
                    [...this.snakeStrategies.values()]
                        .map((strat) =>
                            strat instanceof FoodSnakeStrategy
                                ? strat.target
                                : undefined
                        )
                        .filter(isDefined)
                        .map(toFlat)
                );
                // console.log(
                //      "lockedFoodsFlatAddresses",
                //      lockedFoodsFlatAddresses
                // );
                const closestFoods = this.gameState.foodManager.getClosest(
                    snake.head,
                    this.gameState.startAddress // Prevent trying to get to food at our home address
                );
                // console.log("closestFoods", closestFoods);
                const availableFoods = closestFoods.filter(
                    (foodState) =>
                        !lockedFoodsFlatAddresses.has(toFlat(foodState.address))
                );
                // console.log("availableFoods", availableFoods);
                const newFood = availableFoods[0]?.address;
                if (newFood) {
                    snake.log(`new food target`, newFood);
                    snakeStrat = new FoodSnakeStrategy(
                        this.gameState,
                        snake,
                        newFood
                    );
                }
            }
            if (snakeStrat && !(snakeStrat instanceof SaveSnakeStrategy)) {
                if ((this.nr_of_saving_snakes < this.maxNumberOfSavingSnakes) && (snake.length > this.saveLength)) {
                    snake.log(`snake too long, saving`);
                    snakeStrat = new SaveSnakeStrategy(
                        this.gameState,
                        snake,
                        this.gameState.startAddress
                    );
                    this.nr_of_saving_snakes++;
                }
            }            
            if (!snakeStrat) {
                if (this.nr_of_saving_snakes > 3) {
                    snake.log(`No work left, already saving too many snakes`);
                }
                else {
                    snake.log(`No work left, saving snake...`);
                    snakeStrat = new SaveSnakeStrategy(
                        this.gameState,
                        snake,
                        this.gameState.startAddress
                    );
                    this.nr_of_saving_snakes++;    
                }
            }            
            if (!snakeStrat) {
                // Let snake move 'out of the way' to prevent
                // accidentally blocking other snakes
                snakeStrat = new RandomWalkSnakeStrategy(this.gameState, snake);
            }
            // Update new strategy, even if it's now undefined
            if (snakeStrat) {
                this.snakeStrategies.set(snake.name, snakeStrat);
            } else {
                snake.log(`no new strategy available`);
                this.snakeStrategies.delete(snake.name);
            }
            if (snakeStrat) {
                actions.push(...snakeStrat.update());
            }
        }
        return actions;
    }
}
