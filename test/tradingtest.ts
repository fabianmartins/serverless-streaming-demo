import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as Trading from "../lib/tradingstack"

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new Trading.TradingStack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
